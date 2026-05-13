#pragma once

#include <QString>
#include <QStringList>
#include <QVector>

struct SshProfile {
  QString host = "10.0.0.194";
  QString user = "shane";
  int port = 22;
  QString identityFile;
};

struct DevCommand {
  QString program = "npm";
  QStringList args = {"run", "dev:local"};
  QString readyUrl = "http://127.0.0.1:5173/";
  int readyTimeoutMs = 30000;
};

struct ProjectProfile {
  QString remotePath = "/home/shane/Projects/last-hearth-game";
  QString engineRemotePath;
  DevCommand dev;
  QVector<int> forwardPorts = {5173};
  QStringList ignore = {".git", "node_modules", "dist", "coverage", ".cache", "build"};
};

struct EditorProfile {
  QString id = "dev-server";
  QString name = "Dev Server";
  SshProfile ssh;
  ProjectProfile project;
};

QString defaultProfilePath();
QVector<EditorProfile> loadProfiles(QString* error = nullptr);
bool writeDefaultProfiles(const QString& path, QString* error = nullptr);
QString sshTarget(const SshProfile& profile);
QString shellQuote(const QString& value);
QStringList sshBaseArgs(const SshProfile& profile);
