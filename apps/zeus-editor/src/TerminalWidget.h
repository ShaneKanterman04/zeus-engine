#pragma once

#include "Profile.h"

#include <QPlainTextEdit>
#include <QProcess>
#include <QString>

class TerminalWidget : public QPlainTextEdit {
  Q_OBJECT

 public:
  explicit TerminalWidget(QWidget* parent = nullptr);
  ~TerminalWidget() override;

  void start(const SshProfile& ssh, const QString& remotePath);
  void stop();

 protected:
  void keyPressEvent(QKeyEvent* event) override;

 private:
  void appendProcessOutput(const QByteArray& output);
  void writeCommand();

  QProcess* process_ = nullptr;
  QString currentInput_;
};
