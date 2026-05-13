#include "TerminalBridge.h"

TerminalBridge::TerminalBridge(QObject* parent) : QObject(parent) {}

void TerminalBridge::markReady() {
  emit ready();
}

void TerminalBridge::sendInput(const QString& text) {
  emit inputRequested(text);
}

void TerminalBridge::resizeTerminal(int cols, int rows) {
  emit resizeRequested(cols, rows);
}

void TerminalBridge::pushOutput(const QString& text) {
  emit outputReceived(text);
}

void TerminalBridge::pushExit(int exitCode) {
  emit exited(exitCode);
}
