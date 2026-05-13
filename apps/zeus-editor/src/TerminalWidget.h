#pragma once

#include "Profile.h"
#include "TerminalBridge.h"
#include "TerminalSession.h"

#include <QString>
#include <QWidget>

class QTabWidget;
class QWebEngineView;

class TerminalWidget : public QWidget {
  Q_OBJECT

 public:
  explicit TerminalWidget(QWidget* parent = nullptr);
  ~TerminalWidget() override;

  void start(const SshProfile& ssh, const QString& remotePath);
  void stop();
  void requestFocusTerminal();

 private slots:
  void handleTerminalReady();
  void handleTerminalOutput(const QByteArray& data);
  void handleTerminalExit(int code);

 private:
  void buildUi();
  void loadTerminalPage();
  void flushPendingOutput();
  void appendOutputChunk(const QByteArray& data);

  TerminalBridge* bridge_ = nullptr;
  TerminalSession* session_ = nullptr;
  QWebEngineView* view_ = nullptr;
  QByteArray pendingOutput_;
  bool pageReady_ = false;
  bool sessionQueued_ = false;
  SshProfile ssh_;
  QString remotePath_;
};
