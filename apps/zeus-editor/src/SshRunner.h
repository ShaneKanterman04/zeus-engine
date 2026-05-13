#pragma once

#include "Profile.h"

#include <QObject>
#include <QList>
#include <QProcess>
#include <QString>

class SshRunner : public QObject {
  Q_OBJECT

 public:
  explicit SshRunner(QObject* parent = nullptr);

  QProcess* runRemoteCommand(const SshProfile& ssh, const QString& command, QObject* owner = nullptr) const;
  QProcess* streamRemoteFile(const SshProfile& ssh, const QString& path, QObject* owner = nullptr) const;
  QProcess* startTunnel(const SshProfile& ssh, int localPort, int remotePort, QObject* owner = nullptr) const;
  QProcess* startDevServer(const EditorProfile& profile, QObject* owner = nullptr) const;
  QProcess* killRemotePort(const SshProfile& ssh, int port, QObject* owner = nullptr) const;
  QProcess* killRemotePorts(const SshProfile& ssh, const QList<int>& ports, QObject* owner = nullptr) const;

  QString listDirectoryCommand(const EditorProfile& profile, const QString& path) const;
  QString killPortCommand(int port) const;
  QString killPortsCommand(const QList<int>& ports) const;
};
