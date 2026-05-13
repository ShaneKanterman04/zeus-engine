#pragma once

#include "Profile.h"

#include <QElapsedTimer>
#include <QProcess>
#include <QVector>
#include <QWidget>

class QLabel;
class QPlainTextEdit;
class QPushButton;
class QTimer;

class JobPanelWidget : public QWidget {
  Q_OBJECT

 public:
  explicit JobPanelWidget(QWidget* parent = nullptr);
  ~JobPanelWidget() override;

  void setContext(const SshProfile& ssh, const QString& projectPath, const QString& enginePath);

 signals:
  void jobStarted(const QString& label);
  void jobFinished(const QString& label, int exitCode);

 private:
  struct JobCommand {
    QString label;
    QString workingPath;
    QString command;
  };

  void runJob(const JobCommand& job);
  void appendOutput(const QString& text);
  void setCommandsEnabled(bool enabled);
  void updateElapsed();
  QPushButton* addJobButton(QWidget* parent, const QString& label, const QString& tooltip, const QString& pathKey, const QString& command);

  SshProfile ssh_;
  QString projectPath_;
  QString enginePath_;
  QProcess* process_ = nullptr;
  QString activeLabel_;
  QElapsedTimer elapsed_;
  QTimer* elapsedTimer_ = nullptr;
  QLabel* statusLabel_ = nullptr;
  QLabel* detailLabel_ = nullptr;
  QPlainTextEdit* output_ = nullptr;
  QPushButton* cancelButton_ = nullptr;
  QPushButton* clearButton_ = nullptr;
  QVector<QPushButton*> commandButtons_;
};
