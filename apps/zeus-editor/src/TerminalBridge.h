#pragma once

#include <QObject>
#include <QString>

class TerminalBridge : public QObject {
  Q_OBJECT

 public:
  explicit TerminalBridge(QObject* parent = nullptr);

 public slots:
  void markReady();
  void sendInput(const QString& text);
  void resizeTerminal(int cols, int rows);
  void pushOutput(const QString& text);
  void pushExit(int exitCode);

 signals:
  void ready();
  void inputRequested(const QString& text);
  void resizeRequested(int cols, int rows);
  void outputReceived(const QString& text);
  void exited(int exitCode);
};
