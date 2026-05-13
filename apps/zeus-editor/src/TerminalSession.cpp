#include "TerminalSession.h"

#include <QSocketNotifier>

#include <cerrno>
#include <csignal>
#include <cstring>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

#if defined(__linux__)
#include <vector>
#include <pty.h>
#endif

TerminalSession::TerminalSession(QObject* parent) : QObject(parent) {}

TerminalSession::~TerminalSession() {
  stop();
}

void TerminalSession::start(const SshProfile& ssh, const QString& remotePath) {
  stop();

#if !defined(__linux__)
  emit outputReceived("Embedded terminal is only supported on Linux in this build.\n");
  emit exited(1);
  return;
#else
  int slaveFd = -1;
  if (openpty(&masterFd_, &slaveFd, nullptr, nullptr, nullptr) < 0) {
    emit outputReceived(QString("openpty failed: %1\n").arg(std::strerror(errno)).toUtf8());
    emit exited(1);
    return;
  }

  childPid_ = fork();
  if (childPid_ < 0) {
    emit outputReceived(QString("fork failed: %1\n").arg(std::strerror(errno)).toUtf8());
    stop();
    emit exited(1);
    return;
  }

  if (childPid_ == 0) {
    if (setsid() < 0) _exit(1);
    if (ioctl(slaveFd, TIOCSCTTY, 0) < 0) _exit(1);
    dup2(slaveFd, STDIN_FILENO);
    dup2(slaveFd, STDOUT_FILENO);
    dup2(slaveFd, STDERR_FILENO);
    if (slaveFd > STDERR_FILENO) close(slaveFd);
    if (masterFd_ > STDERR_FILENO) close(masterFd_);

    auto args = sshBaseArgs(ssh);
    args << "-tt"
         << QString("export TERM=xterm-256color COLORTERM=truecolor; cd %1 && exec ${SHELL:-/bin/sh} -i").arg(shellQuote(remotePath));

    QByteArray program = "ssh";
    std::vector<QByteArray> argv;
    argv.reserve(static_cast<size_t>(args.size() + 2));
    argv.emplace_back(program);
    for (const auto& arg : args) argv.emplace_back(arg.toUtf8());
    std::vector<char*> execArgs;
    execArgs.reserve(argv.size());
    for (auto& arg : argv) execArgs.push_back(arg.data());
    execArgs.push_back(nullptr);
    execvp(program.constData(), execArgs.data());
    _exit(127);
  }

  close(slaveFd);
  notifier_ = new QSocketNotifier(masterFd_, QSocketNotifier::Read, this);
  connect(notifier_, &QSocketNotifier::activated, this, &TerminalSession::watchOutput);
  return;
#endif
}

void TerminalSession::stop() {
  if (notifier_) {
    notifier_->setEnabled(false);
    notifier_->deleteLater();
    notifier_ = nullptr;
  }
  if (masterFd_ >= 0) {
    close(masterFd_);
    masterFd_ = -1;
  }
  if (childPid_ > 0) {
    kill(childPid_, SIGTERM);
    int status = 0;
    waitpid(childPid_, &status, WNOHANG);
    childPid_ = -1;
  }
}

void TerminalSession::writeInput(const QString& text) {
  const auto data = text.toUtf8();
  if (masterFd_ < 0 || data.isEmpty()) return;
  ::write(masterFd_, data.constData(), static_cast<size_t>(data.size()));
}

void TerminalSession::resize(int cols, int rows) {
#if defined(__linux__)
  if (masterFd_ < 0) return;
  struct winsize ws {};
  ws.ws_col = static_cast<unsigned short>(cols);
  ws.ws_row = static_cast<unsigned short>(rows);
  ioctl(masterFd_, TIOCSWINSZ, &ws);
  if (childPid_ > 0) kill(childPid_, SIGWINCH);
#else
  Q_UNUSED(cols);
  Q_UNUSED(rows);
#endif
}

void TerminalSession::watchOutput() {
  if (masterFd_ < 0) return;
  QByteArray buffer;
  buffer.resize(4096);
  const auto bytes = ::read(masterFd_, buffer.data(), static_cast<size_t>(buffer.size()));
  if (bytes > 0) {
    buffer.resize(bytes);
    emit outputReceived(buffer);
    return;
  }
  handleExit();
}

void TerminalSession::handleExit() {
  if (notifier_) notifier_->setEnabled(false);
  if (masterFd_ >= 0) {
    close(masterFd_);
    masterFd_ = -1;
  }
  if (childPid_ > 0) {
    int status = 0;
    waitpid(childPid_, &status, 0);
    emit exited(WIFEXITED(status) ? WEXITSTATUS(status) : 1);
    childPid_ = -1;
  }
}
