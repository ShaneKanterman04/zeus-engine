#include "Profile.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QIODevice>
#include <QStandardPaths>

namespace {

QString stringValue(const QJsonObject& object, const QString& key, const QString& fallback) {
  const auto value = object.value(key);
  return value.isString() ? value.toString() : fallback;
}

int intValue(const QJsonObject& object, const QString& key, int fallback) {
  const auto value = object.value(key);
  return value.isDouble() ? value.toInt() : fallback;
}

QStringList stringListValue(const QJsonObject& object, const QString& key, const QStringList& fallback) {
  const auto value = object.value(key);
  if (!value.isArray()) return fallback;
  QStringList result;
  for (const auto item : value.toArray()) {
    if (item.isString()) result.push_back(item.toString());
  }
  return result.isEmpty() ? fallback : result;
}

QVector<int> intVectorValue(const QJsonObject& object, const QString& key, const QVector<int>& fallback) {
  const auto value = object.value(key);
  if (!value.isArray()) return fallback;
  QVector<int> result;
  for (const auto item : value.toArray()) {
    if (item.isDouble()) result.push_back(item.toInt());
  }
  return result.isEmpty() ? fallback : result;
}

EditorProfile parseProfile(const QJsonObject& object) {
  EditorProfile profile;
  profile.id = stringValue(object, "id", profile.id);
  profile.name = stringValue(object, "name", profile.name);

  const auto ssh = object.value("ssh").toObject();
  profile.ssh.host = stringValue(ssh, "host", profile.ssh.host);
  profile.ssh.user = stringValue(ssh, "user", profile.ssh.user);
  profile.ssh.port = intValue(ssh, "port", profile.ssh.port);
  profile.ssh.identityFile = stringValue(ssh, "identityFile", profile.ssh.identityFile);

  const auto project = object.value("project").toObject();
  profile.project.remotePath = stringValue(project, "remotePath", profile.project.remotePath);
  profile.project.forwardPorts = intVectorValue(project, "forwardPorts", profile.project.forwardPorts);
  profile.project.ignore = stringListValue(project, "ignore", profile.project.ignore);

  const auto dev = project.value("devCommand").toObject();
  profile.project.dev.program = stringValue(dev, "program", profile.project.dev.program);
  profile.project.dev.args = stringListValue(dev, "args", profile.project.dev.args);
  profile.project.dev.readyUrl = stringValue(dev, "readyUrl", profile.project.dev.readyUrl);
  profile.project.dev.readyTimeoutMs = intValue(dev, "readyTimeoutMs", profile.project.dev.readyTimeoutMs);

  return profile;
}

QJsonObject profileToJson(const EditorProfile& profile) {
  QJsonObject ssh;
  ssh["host"] = profile.ssh.host;
  ssh["user"] = profile.ssh.user;
  ssh["port"] = profile.ssh.port;
  ssh["identityFile"] = profile.ssh.identityFile;

  QJsonArray args;
  for (const auto& arg : profile.project.dev.args) args.push_back(arg);
  QJsonObject dev;
  dev["program"] = profile.project.dev.program;
  dev["args"] = args;
  dev["readyUrl"] = profile.project.dev.readyUrl;
  dev["readyTimeoutMs"] = profile.project.dev.readyTimeoutMs;

  QJsonArray ports;
  for (const auto port : profile.project.forwardPorts) ports.push_back(port);
  QJsonArray ignore;
  for (const auto& entry : profile.project.ignore) ignore.push_back(entry);

  QJsonObject project;
  project["remotePath"] = profile.project.remotePath;
  project["devCommand"] = dev;
  project["forwardPorts"] = ports;
  project["ignore"] = ignore;

  QJsonObject object;
  object["id"] = profile.id;
  object["name"] = profile.name;
  object["mode"] = "ssh";
  object["ssh"] = ssh;
  object["project"] = project;
  return object;
}

}  // namespace

QString defaultProfilePath() {
  const auto root = QStandardPaths::writableLocation(QStandardPaths::GenericConfigLocation);
  return QDir(root).filePath("Zeus/Editor/profiles.json");
}

QVector<EditorProfile> loadProfiles(QString* error) {
  const auto path = defaultProfilePath();
  if (!QFile::exists(path)) {
    if (!writeDefaultProfiles(path, error)) return {};
  }

  QFile file(path);
  if (!file.open(QIODevice::ReadOnly)) {
    if (error) *error = QString("Could not read %1: %2").arg(path, file.errorString());
    return {};
  }
  const auto document = QJsonDocument::fromJson(file.readAll());
  const auto profiles = document.object().value("profiles").toArray();
  QVector<EditorProfile> result;
  for (const auto item : profiles) {
    if (item.isObject()) result.push_back(parseProfile(item.toObject()));
  }
  if (result.isEmpty()) result.push_back(EditorProfile{});
  return result;
}

bool writeDefaultProfiles(const QString& path, QString* error) {
  QDir().mkpath(QFileInfo(path).absolutePath());
  QJsonObject root;
  root["schemaVersion"] = 1;
  root["profiles"] = QJsonArray{profileToJson(EditorProfile{})};

  QFile file(path);
  if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
    if (error) *error = QString("Could not write %1: %2").arg(path, file.errorString());
    return false;
  }
  file.write(QJsonDocument(root).toJson(QJsonDocument::Indented));
  return true;
}

QString sshTarget(const SshProfile& profile) {
  return profile.user.isEmpty() ? profile.host : QString("%1@%2").arg(profile.user, profile.host);
}

QString shellQuote(const QString& value) {
  auto escaped = value;
  escaped.replace("'", "'\"'\"'");
  return QString("'%1'").arg(escaped);
}

QStringList sshBaseArgs(const SshProfile& profile) {
  QStringList args;
  args << "-p" << QString::number(profile.port);
  if (!profile.identityFile.isEmpty()) args << "-i" << profile.identityFile;
  args << sshTarget(profile);
  return args;
}
