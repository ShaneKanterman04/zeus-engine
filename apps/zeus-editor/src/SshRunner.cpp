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
  const auto cleanupText = killPortsCommand({5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180});
  const auto remote = QString(
                          "%1 ; "
                          "cd %2 && "
                          "set -m; "
                          "%3 & child=$!; "
                          "trap 'kill -TERM -$child 2>/dev/null; kill -TERM $child 2>/dev/null' TERM INT HUP EXIT; "
                          "wait $child")
                          .arg(cleanupText, shellQuote(profile.project.remotePath), commandText);
  return runRemoteCommand(profile.ssh, remote, owner);
}

QProcess* SshRunner::killRemotePort(const SshProfile& ssh, int port, QObject* owner) const {
  return runRemoteCommand(ssh, killPortCommand(port), owner);
}

QProcess* SshRunner::killRemotePorts(const SshProfile& ssh, const QList<int>& ports, QObject* owner) const {
  return runRemoteCommand(ssh, killPortsCommand(ports), owner);
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
  return QString("find %1 -mindepth 1 -maxdepth 1 -printf '%y\\t%f\\t%p\\t%s\\n' 2>/dev/null%2")
      .arg(shellQuote(path), filter);
}

QString SshRunner::killPortCommand(int port) const {
  const auto portText = QString::number(port);
  return QString(
             "pids=$(command -v lsof >/dev/null 2>&1 && lsof -tiTCP:%1 -sTCP:LISTEN || true); "
             "if [ -z \"$pids\" ] && command -v ss >/dev/null 2>&1; then "
             "pids=$(ss -ltnp 'sport = :%1' 2>/dev/null | sed -n 's/.*pid=\\([0-9][0-9]*\\).*/\\1/p' | sort -u); "
             "fi; "
             "if [ -z \"$pids\" ]; then echo 'No process listening on port %1'; exit 0; fi; "
             "echo \"Stopping process(es) on port %1: $pids\"; "
             "kill $pids 2>/dev/null || true; "
             "sleep 1; "
             "alive=''; "
             "for pid in $pids; do if kill -0 \"$pid\" 2>/dev/null; then alive=\"$alive $pid\"; fi; done; "
            "if [ -n \"$alive\" ]; then echo \"Force stopping:$alive\"; kill -9 $alive 2>/dev/null || true; fi")
      .arg(portText);
}

QString SshRunner::killPortsCommand(const QList<int>& ports) const {
  if (ports.isEmpty()) return QStringLiteral("echo 'No ports requested'; exit 0");

  QStringList portText;
  portText.reserve(ports.size());
  for (const auto port : ports) portText << QString::number(port);

  QStringList commands;
  commands.reserve(ports.size());
  for (const auto& port : portText) commands << QString("(%1)").arg(killPortCommand(port.toInt()));
  return commands.join(" ; ");
}
