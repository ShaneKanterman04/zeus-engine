#include "SshRunner.h"

#include <QRegularExpression>

SshRunner::SshRunner(QObject* parent) : QObject(parent) {}

QProcess* SshRunner::runRemoteCommand(const SshProfile& ssh, const QString& command, QObject* owner) const {
  auto* process = new QProcess(owner);
  auto args = sshBaseArgs(ssh);
  args << command;
  process->setProgram("ssh");
  process->setArguments(args);
  process->setProcessChannelMode(QProcess::MergedChannels);
  process->start();
  return process;
}

QProcess* SshRunner::streamRemoteFile(const SshProfile& ssh, const QString& path, QObject* owner) const {
  return runRemoteCommand(ssh, QString("cat -- %1").arg(shellQuote(path)), owner);
}

QProcess* SshRunner::startTunnel(const SshProfile& ssh, int localPort, int remotePort, QObject* owner) const {
  auto* process = new QProcess(owner);
  auto args = sshBaseArgs(ssh);
  args.prepend("-N");
  args.prepend("-L");
  args.insert(1, QString("127.0.0.1:%1:127.0.0.1:%2").arg(localPort).arg(remotePort));
  process->setProgram("ssh");
  process->setArguments(args);
  process->setProcessChannelMode(QProcess::MergedChannels);
  process->start();
  return process;
}

QProcess* SshRunner::startDevServer(const EditorProfile& profile, QObject* owner) const {
  QStringList command;
  command << shellQuote(profile.project.dev.program);
  for (const auto& arg : profile.project.dev.args) command << shellQuote(arg);
  const auto commandText = command.join(" ");
  const auto remote = QString(
                          "cd %1 && "
                          "set -m; "
                          "%2 & child=$!; "
                          "trap 'kill -TERM -$child 2>/dev/null; kill -TERM $child 2>/dev/null' TERM INT HUP EXIT; "
                          "wait $child")
                          .arg(shellQuote(profile.project.remotePath), commandText);
  return runRemoteCommand(profile.ssh, remote, owner);
}

QString SshRunner::listDirectoryCommand(const EditorProfile& profile, const QString& path) const {
  QString ignorePattern;
  for (const auto& entry : profile.project.ignore) {
    if (!ignorePattern.isEmpty()) ignorePattern += "|";
    ignorePattern += QRegularExpression::escape(entry);
  }
  const auto filter =
      ignorePattern.isEmpty()
          ? QString()
          : QString(" | awk -F '\\t' '$2 !~ /^(%1)$/ { print }'").arg(ignorePattern);
  return QString("find %1 -mindepth 1 -maxdepth 1 -printf '%%y\\t%%f\\t%%p\\t%%s\\n' 2>/dev/null%2")
      .arg(shellQuote(path), filter);
}
