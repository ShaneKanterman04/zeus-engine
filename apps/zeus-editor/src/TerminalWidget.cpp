#include "TerminalWidget.h"

#include <QApplication>
#include <QClipboard>
#include <QKeyEvent>
#include <QKeySequence>
#include <QRegularExpression>
#include <QScrollBar>
#include <QTextCursor>

TerminalWidget::TerminalWidget(QWidget* parent) : QPlainTextEdit(parent) {
  setUndoRedoEnabled(false);
  setLineWrapMode(QPlainTextEdit::NoWrap);
  setPlaceholderText("Terminal");
}

TerminalWidget::~TerminalWidget() {
  stop();
}

void TerminalWidget::start(const SshProfile& ssh, const QString& remotePath) {
  stop();
  clear();
  currentInput_.clear();
  appendPlainText(QString("Connecting to %1 in %2...").arg(sshTarget(ssh), remotePath));

  process_ = new QProcess(this);
  auto args = sshBaseArgs(ssh);
  args << "-tt"
       << QString("cd %1 && TERM=dumb NO_COLOR=1 CLICOLOR=0 exec ${SHELL:-/bin/sh} -i").arg(shellQuote(remotePath));
  process_->setProgram("ssh");
  process_->setArguments(args);
  process_->setProcessChannelMode(QProcess::MergedChannels);
  connect(process_, &QProcess::readyRead, this, [this]() {
    appendProcessOutput(process_->readAll());
  });
  connect(process_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int code, QProcess::ExitStatus status) {
    appendPlainText(QString("\nTerminal exited: code=%1 status=%2").arg(code).arg(status));
    process_->deleteLater();
    process_ = nullptr;
  });
  process_->start();
  setFocus();
}

void TerminalWidget::stop() {
  if (!process_) return;
  process_->disconnect(this);
  if (process_->state() != QProcess::NotRunning) {
    process_->write("exit\n");
    process_->terminate();
    if (!process_->waitForFinished(1000)) process_->kill();
  }
  process_->deleteLater();
  process_ = nullptr;
}

void TerminalWidget::keyPressEvent(QKeyEvent* event) {
  if (!process_ || process_->state() == QProcess::NotRunning) {
    QPlainTextEdit::keyPressEvent(event);
    return;
  }

  if (event->key() == Qt::Key_Return || event->key() == Qt::Key_Enter) {
    insertPlainText("\n");
    writeCommand();
    return;
  }

  if (event->key() == Qt::Key_Backspace) {
    if (currentInput_.isEmpty()) return;
    currentInput_.chop(1);
    auto cursor = textCursor();
    cursor.deletePreviousChar();
    setTextCursor(cursor);
    return;
  }

  if (event->matches(QKeySequence::Copy)) {
    copy();
    return;
  }

  if (event->matches(QKeySequence::Paste)) {
    const auto pasted = QApplication::clipboard()->text();
    currentInput_ += pasted;
    insertPlainText(pasted);
    return;
  }

  const auto text = event->text();
  if (text.isEmpty() || text.at(0).unicode() < 0x20) return;
  currentInput_ += text;
  insertPlainText(text);
}

void TerminalWidget::appendProcessOutput(const QByteArray& output) {
  moveCursor(QTextCursor::End);
  insertPlainText(stripTerminalOutput(QString::fromLocal8Bit(output)));
  verticalScrollBar()->setValue(verticalScrollBar()->maximum());
}

void TerminalWidget::writeCommand() {
  process_->write(currentInput_.toLocal8Bit());
  process_->write("\n");
  currentInput_.clear();
}

QString stripTerminalOutput(const QString& text) {
  static const QRegularExpression csi(R"(\x1B\[[0-?]*[ -/]*[@-~])");
  static const QRegularExpression osc(R"(\x1B\][^\a]*(?:\a|\x1B\\))");
  static const QRegularExpression singleByte(R"(\x1B[@-Z\\-_])");
  auto cleaned = text;
  cleaned.replace("\r", "\n");
  cleaned.replace(csi, "");
  cleaned.replace(osc, "");
  cleaned.replace(singleByte, "");
  QString result;
  result.reserve(cleaned.size());
  for (const auto ch : cleaned) {
    const auto code = ch.unicode();
    if (code == '\n' || code == '\t' || code >= 0x20) {
      result.append(ch);
    }
  }
  return result;
}
