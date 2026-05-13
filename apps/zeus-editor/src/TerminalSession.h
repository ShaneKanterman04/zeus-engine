#pragma once

#include "Profile.h"

#include <QObject>
#include <QString>
#include <sys/types.h>

class QSocketNotifier;

class TerminalSession : public QObject {
  Q_OBJECT

 public:
  explicit TerminalSession(QObject* parent = nullptr);
  ~TerminalSession() override;

  void start(const SshProfile& ssh, const QString& remotePath);
  void stop();
  void writeInput(const QString& text);
  void resize(int cols, int rows);

 signals:
  void outputReceived(const QByteArray& data);
  void exited(int exitCode);

 private:
  void watchOutput();
  void handleExit();

  int masterFd_ = -1;
  pid_t childPid_ = -1;
  QSocketNotifier* notifier_ = nullptr;
};
