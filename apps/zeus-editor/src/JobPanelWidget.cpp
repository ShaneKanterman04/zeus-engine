#include "JobPanelWidget.h"

#include <QDateTime>
#include <QGridLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QTimer>
#include <QVBoxLayout>

namespace {

constexpr const char* ProjectPathKey = "project";
constexpr const char* EnginePathKey = "engine";

QString formatDuration(qint64 milliseconds) {
  const auto seconds = milliseconds / 1000;
  return QString("%1:%2").arg(seconds / 60, 2, 10, QChar('0')).arg(seconds % 60, 2, 10, QChar('0'));
}

}  // namespace

JobPanelWidget::JobPanelWidget(QWidget* parent) : QWidget(parent) {
  auto* layout = new QVBoxLayout(this);
  layout->setContentsMargins(12, 12, 12, 12);
  layout->setSpacing(10);

  auto* statusRow = new QHBoxLayout();
  statusRow->setContentsMargins(0, 0, 0, 0);
  statusRow->setSpacing(8);
  statusLabel_ = new QLabel("Ready", this);
  statusLabel_->setObjectName("jobStatus");
  detailLabel_ = new QLabel("Managed commands run separately from the terminal.", this);
  detailLabel_->setObjectName("jobDetail");
  statusRow->addWidget(statusLabel_);
  statusRow->addWidget(detailLabel_, 1);

  cancelButton_ = new QPushButton("Cancel", this);
  cancelButton_->setEnabled(false);
  clearButton_ = new QPushButton("Clear", this);
  statusRow->addWidget(cancelButton_);
  statusRow->addWidget(clearButton_);

  auto* buttonGrid = new QGridLayout();
  buttonGrid->setContentsMargins(0, 0, 0, 0);
  buttonGrid->setHorizontalSpacing(8);
  buttonGrid->setVerticalSpacing(8);

  const QVector<QPushButton*> projectButtons = {
      addJobButton(this, "Validate Content", "Run Last Hearth content validation", ProjectPathKey, "npm run validate:content"),
      addJobButton(this, "Test", "Run Last Hearth tests", ProjectPathKey, "npm test -- tests/last-hearth.test.ts"),
      addJobButton(this, "Build", "Build Last Hearth", ProjectPathKey, "npm run build"),
      addJobButton(this, "Browser Smoke", "Run browser smoke test", ProjectPathKey, "npm run smoke:browser"),
      addJobButton(this, "LAN Smoke", "Run LAN smoke test", ProjectPathKey, "npm run smoke:lan"),
      addJobButton(this, "Readiness", "Run playtest readiness check", ProjectPathKey, "npm run playtest:readiness"),
      addJobButton(this, "Full Verify", "Run full Last Hearth verification", ProjectPathKey, "npm run verify"),
  };

  int row = 0;
  int column = 0;
  for (auto* button : projectButtons) {
    buttonGrid->addWidget(button, row, column);
    column += 1;
    if (column == 4) {
      column = 0;
      row += 1;
    }
  }

  row += 1;
  column = 0;
  const QVector<QPushButton*> engineButtons = {
      addJobButton(this, "Zeus Build", "Build Zeus engine", EnginePathKey, "npm run build"),
      addJobButton(this, "Zeus Typecheck", "Run Zeus typecheck", EnginePathKey, "npm run typecheck"),
      addJobButton(this, "Zeus Exports", "Check Zeus package exports", EnginePathKey, "npm run check:exports"),
  };
  for (auto* button : engineButtons) {
    buttonGrid->addWidget(button, row, column);
    column += 1;
  }
  buttonGrid->setColumnStretch(3, 1);

  output_ = new QPlainTextEdit(this);
  output_->setReadOnly(true);
  output_->setMaximumBlockCount(4000);
  output_->setPlaceholderText("Command output appears here.");

  layout->addLayout(statusRow);
  layout->addLayout(buttonGrid);
  layout->addWidget(output_, 1);

  elapsedTimer_ = new QTimer(this);
  elapsedTimer_->setInterval(500);
  connect(elapsedTimer_, &QTimer::timeout, this, &JobPanelWidget::updateElapsed);
  connect(cancelButton_, &QPushButton::clicked, this, [this]() {
    if (!process_) return;
    statusLabel_->setText("Cancelling");
    appendOutput("Cancelling job...");
    process_->terminate();
    QTimer::singleShot(1500, this, [this]() {
      if (process_ && process_->state() != QProcess::NotRunning) process_->kill();
    });
  });
  connect(clearButton_, &QPushButton::clicked, output_, &QPlainTextEdit::clear);
}

JobPanelWidget::~JobPanelWidget() {
  if (!process_) return;
  process_->disconnect(this);
  if (process_->state() != QProcess::NotRunning) {
    process_->terminate();
    if (!process_->waitForFinished(1000)) process_->kill();
  }
}

void JobPanelWidget::setContext(const SshProfile& ssh, const QString& projectPath, const QString& enginePath) {
  ssh_ = ssh;
  projectPath_ = projectPath;
  enginePath_ = enginePath;
}

QPushButton* JobPanelWidget::addJobButton(QWidget* parent, const QString& label, const QString& tooltip, const QString& pathKey, const QString& command) {
  auto* button = new QPushButton(label, parent);
  button->setObjectName("jobButton");
  button->setToolTip(tooltip);
  commandButtons_.push_back(button);
  connect(button, &QPushButton::clicked, this, [this, label, pathKey, command]() {
    const auto workingPath = pathKey == EnginePathKey ? enginePath_ : projectPath_;
    runJob({label, workingPath, command});
  });
  return button;
}

void JobPanelWidget::runJob(const JobCommand& job) {
  if (process_) return;
  if (job.workingPath.trimmed().isEmpty()) {
    appendOutput(QString("[%1] Missing remote path for %2").arg(QDateTime::currentDateTime().toString("HH:mm:ss"), job.label));
    return;
  }

  activeLabel_ = job.label;
  process_ = new QProcess(this);
  process_->setProgram("ssh");
  auto args = sshBaseArgs(ssh_);
  args << QString("cd %1 && %2").arg(shellQuote(job.workingPath), job.command);
  process_->setArguments(args);
  process_->setProcessChannelMode(QProcess::MergedChannels);

  connect(process_, &QProcess::readyRead, this, [this]() { appendOutput(QString::fromUtf8(process_->readAll())); });
  connect(process_, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
    appendOutput(QString("Process error: %1").arg(error));
  });
  connect(process_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int code, QProcess::ExitStatus status) {
    elapsedTimer_->stop();
    appendOutput(QString("\n[%1] Finished %2: code=%3 status=%4 elapsed=%5")
                     .arg(QDateTime::currentDateTime().toString("HH:mm:ss"), activeLabel_)
                     .arg(code)
                     .arg(status)
                     .arg(formatDuration(elapsed_.elapsed())));
    statusLabel_->setText(code == 0 && status == QProcess::NormalExit ? "Passed" : "Failed");
    detailLabel_->setText(QString("%1 finished in %2").arg(activeLabel_, formatDuration(elapsed_.elapsed())));
    setCommandsEnabled(true);
    cancelButton_->setEnabled(false);
    emit jobFinished(activeLabel_, code);
    process_->deleteLater();
    process_ = nullptr;
  });

  setCommandsEnabled(false);
  cancelButton_->setEnabled(true);
  statusLabel_->setText("Running");
  detailLabel_->setText(job.label);
  appendOutput(QString("\n[%1] $ cd %2 && %3\n").arg(QDateTime::currentDateTime().toString("HH:mm:ss"), job.workingPath, job.command));
  elapsed_.restart();
  elapsedTimer_->start();
  emit jobStarted(job.label);
  process_->start();
}

void JobPanelWidget::appendOutput(const QString& text) {
  if (text.isEmpty()) return;
  output_->moveCursor(QTextCursor::End);
  output_->insertPlainText(text);
  output_->moveCursor(QTextCursor::End);
}

void JobPanelWidget::setCommandsEnabled(bool enabled) {
  for (auto* button : commandButtons_) button->setEnabled(enabled);
}

void JobPanelWidget::updateElapsed() {
  if (!process_) return;
  detailLabel_->setText(QString("%1 running %2").arg(activeLabel_, formatDuration(elapsed_.elapsed())));
}
