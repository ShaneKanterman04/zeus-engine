#include "AssetStudioWidget.h"

#include "EditorIcons.h"

#include <QAbstractItemView>
#include <QComboBox>
#include <QDateTime>
#include <QFileInfo>
#include <QGridLayout>
#include <QHBoxLayout>
#include <QImage>
#include <QLabel>
#include <QLineEdit>
#include <QListView>
#include <QListWidget>
#include <QPixmap>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QRegularExpression>
#include <QSize>
#include <QTextEdit>
#include <QTimer>
#include <QVBoxLayout>

#include <algorithm>

namespace {

constexpr int kThumbSize = 160;
constexpr const char* kCodexYoloFlag = "--dangerously-bypass-approvals-and-sandbox";

QString sanitizedSlug(QString value) {
  value = value.trimmed().toLower();
  value.replace(QRegularExpression("[^a-z0-9._-]+"), "-");
  value.replace(QRegularExpression("^-+|-+$"), "");
  return value.isEmpty() ? QString("asset") : value;
}

void stopProcess(QProcess*& process) {
  if (!process) return;
  process->disconnect();
  if (process->state() != QProcess::NotRunning) {
    process->terminate();
    if (!process->waitForFinished(1200)) process->kill();
  }
  process->deleteLater();
  process = nullptr;
}

QString imageName(const QString& path) {
  return QFileInfo(path).fileName();
}

qint64 parseSize(const QString& text) {
  bool ok = false;
  const auto size = text.toLongLong(&ok);
  return ok ? size : 0;
}

}  // namespace

AssetStudioWidget::AssetStudioWidget(QWidget* parent) : QWidget(parent) {
  buildUi();
}

AssetStudioWidget::~AssetStudioWidget() {
  stopProcess(process_);
  stopProcess(thumbnailProcess_);
}

void AssetStudioWidget::setContext(const SshProfile& ssh, const QString& remoteRoot) {
  sshProfile_ = ssh;
  remoteRoot_ = remoteRoot;
}

void AssetStudioWidget::focusPrompt() {
  if (promptEdit_) promptEdit_->setFocus();
}

void AssetStudioWidget::refreshStyleProfile() {
  if (process_) return;
  startStyleProfileRefresh(false);
}

void AssetStudioWidget::generateConcepts() {
  if (process_) return;
  if (assetRequestText().trimmed().isEmpty()) {
    appendLog("Enter an asset prompt or slug before generating concepts.\n");
    phaseLabel_->setText("Needs asset prompt");
    emit statusMessage("Asset Studio needs an asset prompt");
    updateGenerateState();
    return;
  }
  if (!styleProfileExists()) {
    pendingConceptAfterStyleProfile_ = true;
    startStyleProfileRefresh(true);
    return;
  }
  currentRunPath_ = nextRunPath();
  activeRunPath_ = currentRunPath_;
  refinedPath_.clear();
  clearImages();
  const auto command = QString("mkdir -p %1 && cd %2 && codex exec --cd %2 %3 %4 --output-last-message %5 %6")
                           .arg(shellQuote(currentRunPath_), shellQuote(remoteRoot_), QString(kCodexYoloFlag),
                                contactSheetArgs(),
                                shellQuote(QString("%1/codex-final.md").arg(currentRunPath_)), shellQuote(codexConceptPrompt(currentRunPath_)));
  startRemoteCommand(JobKind::Concepts, "Generating concept sheet", command);
}

void AssetStudioWidget::refineSelected() {
  const auto selectedPath = selectedImagePath();
  if (process_ || selectedPath.isEmpty()) return;
  if (!styleProfileExists()) {
    appendLog("Refresh the style profile before refining selected concepts.\n");
    phaseLabel_->setText("Style profile required");
    summaryLabel_->setText(QString("Missing style profile: %1").arg(styleProfileJsonPath()));
    emit statusMessage("Asset Studio needs a style profile");
    return;
  }
  const auto refineRunPath = QString("%1/refine-%2").arg(currentRunPath_, QDateTime::currentDateTimeUtc().toString("HHmmss"));
  activeRunPath_ = refineRunPath;
  refinedPath_ = QString("%1/runtime-candidate.png").arg(refineRunPath);
  const auto command = QString("mkdir -p %1 && cd %2 && codex exec --cd %2 %3 %4 --image %5 --output-last-message %6 %7")
                           .arg(shellQuote(refineRunPath), shellQuote(remoteRoot_), QString(kCodexYoloFlag), contactSheetArgs(), shellQuote(selectedPath),
                                shellQuote(QString("%1/codex-final.md").arg(refineRunPath)), shellQuote(codexRefinePrompt(refineRunPath, selectedPath)));
  startRemoteCommand(JobKind::Refine, "Refining selected concept", command);
}

void AssetStudioWidget::promoteSelected() {
  const auto sourcePath = refinedPath_.isEmpty() ? selectedImagePath() : refinedPath_;
  if (process_ || sourcePath.isEmpty()) return;
  const auto relativePath = promotedRelativePath();
  const auto targetPath = QString("%1/%2").arg(remoteRoot_, relativePath);
  const auto metadataPath = QString("%1/%2.promotion.json").arg(remoteRoot_, relativePath);
  const auto metadata = QString("{\"source\":\"%1\",\"promotedAt\":\"%2\",\"slug\":\"%3\",\"domain\":\"%4\"}\n")
                            .arg(sourcePath, QDateTime::currentDateTimeUtc().toString(Qt::ISODate), slug(), domainCombo_->currentText());
  const auto command = QString("mkdir -p \"$(dirname %1)\" && cp %2 %1 && printf %3 > %4")
                           .arg(shellQuote(targetPath), shellQuote(sourcePath), shellQuote(metadata), shellQuote(metadataPath));
  startRemoteCommand(JobKind::Promote, "Promoting selected image", command);
}

void AssetStudioWidget::runPackAndValidate() {
  if (process_) return;
  const auto command = QString("cd %1 && %2 && npm run validate:content").arg(shellQuote(remoteRoot_), packCommand());
  startRemoteCommand(JobKind::PackValidate, "Packing and validating assets", command);
}

void AssetStudioWidget::cancelJob() {
  if (process_) {
    cancelRequested_ = true;
    appendLog("Cancelling active job...\n");
    process_->terminate();
    QTimer::singleShot(1500, this, [this]() {
      if (process_ && process_->state() != QProcess::NotRunning) process_->kill();
    });
  }
}

void AssetStudioWidget::handleSelectionChanged() {
  const auto selected = selectedImagePath();
  selectedLabel_->setText(selected.isEmpty() ? "No image selected" : selected);
  refineButton_->setEnabled(!selected.isEmpty() && !process_);
  promoteButton_->setEnabled(!selected.isEmpty() && !process_);
}

void AssetStudioWidget::updateGenerateState() {
  if (!generateButton_) return;
  generateButton_->setEnabled(!process_ && !assetRequestText().trimmed().isEmpty());
}

void AssetStudioWidget::buildUi() {
  auto* root = new QVBoxLayout(this);
  root->setContentsMargins(12, 12, 12, 12);
  root->setSpacing(10);

  auto* top = new QGridLayout();
  top->setHorizontalSpacing(8);
  top->setVerticalSpacing(8);

  slugEdit_ = new QLineEdit(this);
  slugEdit_->setPlaceholderText("asset slug");
  domainCombo_ = new QComboBox(this);
  domainCombo_->addItems({"core entity", "environment", "loose runtime"});
  packCombo_ = new QComboBox(this);
  packCombo_->addItems({"core sprites", "environment", "validate only"});
  promotePathEdit_ = new QLineEdit(this);
  promotePathEdit_->setPlaceholderText("games/last-hearth/assets_source/approved/codex/<slug>.png");

  top->addWidget(new QLabel("Slug", this), 0, 0);
  top->addWidget(slugEdit_, 0, 1);
  top->addWidget(new QLabel("Target", this), 0, 2);
  top->addWidget(domainCombo_, 0, 3);
  top->addWidget(new QLabel("Pack", this), 0, 4);
  top->addWidget(packCombo_, 0, 5);
  top->addWidget(new QLabel("Promote path", this), 1, 0);
  top->addWidget(promotePathEdit_, 1, 1, 1, 5);

  promptEdit_ = new QTextEdit(this);
  promptEdit_->setPlaceholderText("Describe the Last Hearth asset concept: subject, camera, style, silhouettes, gameplay purpose, required variants.");
  promptEdit_->setMinimumHeight(92);

  auto* buttons = new QHBoxLayout();
  buttons->setSpacing(8);
  generateButton_ = new QPushButton("Generate Concepts", this);
  styleProfileButton_ = new QPushButton("Refresh Style Profile", this);
  refineButton_ = new QPushButton("Refine Selected", this);
  promoteButton_ = new QPushButton("Promote", this);
  packButton_ = new QPushButton("Pack + Validate", this);
  cancelButton_ = new QPushButton("Cancel", this);
  refineButton_->setEnabled(false);
  promoteButton_->setEnabled(false);
  generateButton_->setEnabled(false);
  cancelButton_->setEnabled(false);
  buttons->addWidget(generateButton_);
  buttons->addWidget(styleProfileButton_);
  buttons->addWidget(refineButton_);
  buttons->addWidget(promoteButton_);
  buttons->addWidget(packButton_);
  buttons->addStretch(1);
  buttons->addWidget(cancelButton_);

  phaseLabel_ = new QLabel("Idle", this);
  phaseLabel_->setObjectName("panelHeading");
  selectedLabel_ = new QLabel("No image selected", this);
  selectedLabel_->setTextInteractionFlags(Qt::TextSelectableByMouse);
  summaryLabel_ = new QLabel("Ready to generate or refine assets.", this);
  summaryLabel_->setTextInteractionFlags(Qt::TextSelectableByMouse);
  summaryLabel_->setWordWrap(true);

  progressList_ = new QListWidget(this);
  progressList_->setSelectionMode(QAbstractItemView::NoSelection);
  progressList_->setFocusPolicy(Qt::NoFocus);
  progressList_->setMaximumHeight(176);
  progressList_->setUniformItemSizes(true);
  resetProgress();

  auto* body = new QHBoxLayout();
  body->setSpacing(10);
  imageList_ = new QListWidget(this);
  imageList_->setViewMode(QListView::IconMode);
  imageList_->setResizeMode(QListView::Adjust);
  imageList_->setMovement(QListView::Static);
  imageList_->setSelectionMode(QAbstractItemView::SingleSelection);
  imageList_->setIconSize(QSize(kThumbSize, kThumbSize));
  imageList_->setGridSize(QSize(kThumbSize + 70, kThumbSize + 56));
  imageList_->setUniformItemSizes(true);

  log_ = new QPlainTextEdit(this);
  log_->setReadOnly(true);
  log_->setMaximumBlockCount(3000);
  body->addWidget(imageList_, 3);
  body->addWidget(log_, 2);

  root->addLayout(top);
  root->addWidget(promptEdit_);
  root->addLayout(buttons);
  root->addWidget(phaseLabel_);
  root->addWidget(progressList_);
  root->addWidget(summaryLabel_);
  root->addWidget(selectedLabel_);
  root->addLayout(body, 1);

  connect(styleProfileButton_, &QPushButton::clicked, this, &AssetStudioWidget::refreshStyleProfile);
  connect(generateButton_, &QPushButton::clicked, this, &AssetStudioWidget::generateConcepts);
  connect(refineButton_, &QPushButton::clicked, this, &AssetStudioWidget::refineSelected);
  connect(promoteButton_, &QPushButton::clicked, this, &AssetStudioWidget::promoteSelected);
  connect(packButton_, &QPushButton::clicked, this, &AssetStudioWidget::runPackAndValidate);
  connect(cancelButton_, &QPushButton::clicked, this, &AssetStudioWidget::cancelJob);
  connect(imageList_, &QListWidget::itemSelectionChanged, this, &AssetStudioWidget::handleSelectionChanged);
  connect(slugEdit_, &QLineEdit::textChanged, this, &AssetStudioWidget::updateGenerateState);
  connect(promptEdit_, &QTextEdit::textChanged, this, &AssetStudioWidget::updateGenerateState);

  elapsedTimer_ = new QTimer(this);
  elapsedTimer_->setInterval(1000);
  connect(elapsedTimer_, &QTimer::timeout, this, &AssetStudioWidget::updateElapsedStatus);
}

bool AssetStudioWidget::useLocalExecution() const {
  return QFileInfo(remoteRoot_).isDir();
}

QProcess* AssetStudioWidget::startCommand(const QString& command) {
  if (!useLocalExecution()) {
    auto* process = ssh_.runRemoteCommand(sshProfile_, command, this);
    process->closeWriteChannel();
    return process;
  }

  auto* process = new QProcess(this);
  process->setProgram("bash");
  process->setArguments({"-lc", command});
  process->setProcessChannelMode(QProcess::MergedChannels);
  process->setStandardInputFile(QProcess::nullDevice());
  process->start();
  process->closeWriteChannel();
  return process;
}

void AssetStudioWidget::startRemoteCommand(JobKind kind, const QString& label, const QString& command) {
  if (remoteRoot_.trimmed().isEmpty()) {
    appendLog("Remote project path is empty.\n");
    return;
  }
  stopProcess(process_);
  jobKind_ = kind;
  beginRun(kind, label);
  process_ = startCommand(command);
  setBusy(true, label);
  appendLog(QString("\n[%1] %2\n%3\n").arg(QDateTime::currentDateTime().toString("HH:mm:ss"), label, command));
  connect(process_, &QProcess::readyRead, this, [this]() { appendProcessOutput(QString::fromUtf8(process_->readAll())); });
  connect(process_, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
    appendLog(QString("Process error: %1\n").arg(error));
    failRun(QString("Process error: %1").arg(error));
  });
  connect(process_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, &AssetStudioWidget::finishJob);
  emit statusMessage(label);
}

void AssetStudioWidget::finishJob(int code, QProcess::ExitStatus status) {
  const auto finishedKind = jobKind_;
  appendLog(QString("\nFinished: code=%1 status=%2\n").arg(code).arg(status));
  stopProcess(process_);
  jobKind_ = JobKind::None;
  if (elapsedTimer_) elapsedTimer_->stop();
  setBusy(false);
  if (cancelRequested_ || status == QProcess::CrashExit) {
    const auto canceledStep = finishedKind == JobKind::Promote ? RunStep::Promote : finishedKind == JobKind::PackValidate ? RunStep::Validate : RunStep::Codex;
    updateStep(canceledStep, StepState::Canceled, "Process stopped before completion");
    phaseLabel_->setText("Canceled");
    summaryLabel_->setText("Run canceled before Asset Studio could verify output files.");
    cancelRequested_ = false;
    emit statusMessage("Asset Studio canceled");
    return;
  }
  if (code != 0) {
    failRun(QString("Command failed with exit code %1").arg(code));
    emit statusMessage("Asset Studio job failed");
    return;
  }
  if (finishedKind == JobKind::StyleProfile) {
    if (!styleProfileExists()) {
      updateStep(RunStep::StyleProfile, StepState::Failed, QString("Missing %1").arg(styleProfileJsonPath()));
      phaseLabel_->setText("Style profile failed");
      summaryLabel_->setText(QString("Codex finished but did not write the style profile: %1").arg(styleProfileJsonPath()));
      pendingConceptAfterStyleProfile_ = false;
      emit statusMessage("Asset Studio style profile failed");
      return;
    }
    updateStep(RunStep::StyleProfile, StepState::Done, "Cached style profile ready");
    updateStep(RunStep::Codex, StepState::Done, "Codex exploration completed");
    summaryLabel_->setText(QString("Style profile refreshed: %1").arg(styleProfileJsonPath()));
    phaseLabel_->setText("Style profile ready");
    emit statusMessage("Asset Studio style profile ready");
    if (pendingConceptAfterStyleProfile_) {
      pendingConceptAfterStyleProfile_ = false;
      QTimer::singleShot(0, this, &AssetStudioWidget::generateConcepts);
    }
    return;
  }
  if (finishedKind == JobKind::Concepts || finishedKind == JobKind::Refine) {
    updateStep(RunStep::Codex, StepState::Done, "Codex exited successfully");
    updateStep(RunStep::Generate, StepState::Done, "Generation command completed");
    refreshRunImages();
    return;
  }
  if (finishedKind == JobKind::Promote) {
    updateStep(RunStep::Promote, StepState::Done, "Image copied to project asset path");
    summaryLabel_->setText("Promotion completed. Asset browser and file tree are refreshing.");
    emit assetsChanged();
  }
  if (finishedKind == JobKind::PackValidate) {
    updateStep(RunStep::Validate, StepState::Done, "Pack and validation command completed");
    summaryLabel_->setText("Pack and validation completed successfully.");
    emit assetsChanged();
  }
  phaseLabel_->setText("Asset Studio ready");
  emit statusMessage("Asset Studio ready");
}

void AssetStudioWidget::appendLog(const QString& text) {
  if (text.isEmpty()) return;
  auto filtered = text;
  filtered.replace("Reading additional input from stdin...\n", "");
  filtered.replace("Reading additional input from stdin...", "");
  if (filtered.isEmpty()) return;
  log_->moveCursor(QTextCursor::End);
  log_->insertPlainText(filtered);
  log_->moveCursor(QTextCursor::End);
}

void AssetStudioWidget::appendProcessOutput(const QString& text) {
  appendLog(text);
  if (text.contains("OpenAI Codex", Qt::CaseInsensitive) || text.contains("session id:", Qt::CaseInsensitive)) {
    updateStep(RunStep::Codex, StepState::Running, "Codex session started");
  }
  if (text.contains("imagegen", Qt::CaseInsensitive) || text.contains("generated", Qt::CaseInsensitive)) {
    updateStep(RunStep::Generate, StepState::Running, "Image generation in progress");
  }
  if (text.contains("verified", Qt::CaseInsensitive) || text.contains("Files verified", Qt::CaseInsensitive)) {
    updateStep(RunStep::Verify, StepState::Running, "Codex reported file verification");
  }
  if (text.contains("error", Qt::CaseInsensitive) || text.contains("failed", Qt::CaseInsensitive)) {
    summaryLabel_->setText("Codex reported an error. Asset Studio will verify files when the command exits.");
  }
}

void AssetStudioWidget::setBusy(bool busy, const QString& label) {
  updateGenerateState();
  packButton_->setEnabled(!busy);
  styleProfileButton_->setEnabled(!busy);
  cancelButton_->setEnabled(busy);
  phaseLabel_->setText(busy ? QString("%1... 0s elapsed").arg(label) : phaseLabel_->text());
  handleSelectionChanged();
}

void AssetStudioWidget::beginRun(JobKind kind, const QString& label) {
  activeRunKind_ = kind;
  activeRunLabel_ = label;
  cancelRequested_ = false;
  runStartedAt_ = QDateTime::currentDateTime();
  resetProgress();
  summaryLabel_->setText(QString("Run folder: %1").arg(activeRunPath_.isEmpty() ? currentRunPath_ : activeRunPath_));
  updateStep(RunStep::Prepare, StepState::Done, "Inputs checked and run folder selected");
  if (kind == JobKind::StyleProfile) {
    updateStep(RunStep::StyleProfile, StepState::Running, "Codex is exploring Last Hearth style sources");
    updateStep(RunStep::Codex, StepState::Running, "Starting Codex CLI");
  } else if (kind == JobKind::Concepts || kind == JobKind::Refine) {
    updateStep(RunStep::StyleProfile, StepState::Done, "Cached style profile loaded");
    updateStep(RunStep::Codex, StepState::Running, "Starting Codex CLI");
    updateStep(RunStep::Generate, StepState::Running, "Waiting for image generation output");
  } else if (kind == JobKind::Promote) {
    updateStep(RunStep::Promote, StepState::Running, "Copying selected image");
  } else if (kind == JobKind::PackValidate) {
    updateStep(RunStep::Validate, StepState::Running, "Running pack and validation commands");
  }
  if (elapsedTimer_) elapsedTimer_->start();
}

void AssetStudioWidget::resetProgress() {
  if (!progressList_) return;
  progressItems_.clear();
  progressList_->clear();
  progressItems_.resize(static_cast<int>(RunStep::Count));
  for (int i = 0; i < static_cast<int>(RunStep::Count); ++i) {
    const auto step = static_cast<RunStep>(i);
    auto* item = new QListWidgetItem(QString("%1 %2").arg(statePrefix(StepState::Waiting), stepName(step)));
    progressList_->addItem(item);
    progressItems_[i] = item;
  }
}

void AssetStudioWidget::updateStep(RunStep step, StepState state, const QString& detail) {
  const auto index = static_cast<int>(step);
  auto* item = index >= 0 && index < progressItems_.size() ? progressItems_[index] : nullptr;
  if (!item) return;
  const auto stamp = QDateTime::currentDateTime().toString("HH:mm:ss");
  const auto suffix = detail.isEmpty() ? QString() : QString(" - %1").arg(detail);
  item->setText(QString("%1 %2 [%3]%4").arg(statePrefix(state), stepName(step), stamp, suffix));
}

void AssetStudioWidget::failRun(const QString& message) {
  if (elapsedTimer_) elapsedTimer_->stop();
  auto failedStep = RunStep::Codex;
  if (activeRunKind_ == JobKind::Promote) failedStep = RunStep::Promote;
  if (activeRunKind_ == JobKind::PackValidate) failedStep = RunStep::Validate;
  if (activeRunKind_ == JobKind::StyleProfile) failedStep = RunStep::StyleProfile;
  updateStep(failedStep, StepState::Failed, message);
  phaseLabel_->setText("Asset Studio job failed");
  summaryLabel_->setText(message);
}

void AssetStudioWidget::updateElapsedStatus() {
  if (!runStartedAt_.isValid() || activeRunLabel_.isEmpty() || !process_) return;
  const auto seconds = runStartedAt_.secsTo(QDateTime::currentDateTime());
  phaseLabel_->setText(QString("%1... %2s elapsed").arg(activeRunLabel_).arg(seconds));
}

void AssetStudioWidget::finishRunSummary(const QList<RunFile>& files, const QStringList& missing) {
  if (!missing.isEmpty()) {
    const auto message = QString("Missing expected files in %1: %2").arg(activeRunPath_, missing.join(", "));
    updateStep(RunStep::Verify, StepState::Failed, message);
    phaseLabel_->setText("Output verification failed");
    summaryLabel_->setText(message);
    appendLog(QString("%1\n").arg(message));
    emit statusMessage("Asset Studio: missing generated files");
    return;
  }

  updateStep(RunStep::Verify, StepState::Done, QString("%1 files verified").arg(files.size()));
  updateStep(RunStep::Review, StepState::Done, "Run summary ready");
  const auto manifestOk = files.end() != std::find_if(files.begin(), files.end(), [](const RunFile& file) { return file.name == "manifest.json" || file.name == "candidate.metadata.json"; });
  summaryLabel_->setText(QString("Verified %1 files in %2. %3").arg(files.size()).arg(activeRunPath_, manifestOk ? "Manifest found." : "No manifest metadata found."));
  phaseLabel_->setText("Generated assets ready for review");
  emit statusMessage("Asset Studio: generated assets ready");
}

QStringList AssetStudioWidget::expectedFilesFor(JobKind kind) const {
  if (kind == JobKind::Concepts) return {"concept-sheet.png", "concept-01.png", "concept-02.png", "concept-03.png", "concept-04.png", "manifest.json"};
  if (kind == JobKind::Refine) return {"refined.png", "runtime-candidate.png", "candidate.metadata.json", "qa.md"};
  return {};
}

QString AssetStudioWidget::stepName(RunStep step) const {
  switch (step) {
    case RunStep::Prepare:
      return "Prepare run";
    case RunStep::StyleProfile:
      return "Style Profile";
    case RunStep::Codex:
      return "Start Codex";
    case RunStep::Generate:
      return "Generate images";
    case RunStep::Verify:
      return "Verify files";
    case RunStep::Thumbnails:
      return "Load thumbnails";
    case RunStep::Review:
      return "Review results";
    case RunStep::Refine:
      return "Refine";
    case RunStep::Promote:
      return "Promote";
    case RunStep::Validate:
      return "Pack/Validate";
    case RunStep::Count:
      return {};
  }
  return {};
}

QString AssetStudioWidget::statePrefix(StepState state) const {
  switch (state) {
    case StepState::Waiting:
      return "[ ]";
    case StepState::Running:
      return "[>]";
    case StepState::Done:
      return "[ok]";
    case StepState::Failed:
      return "[x]";
    case StepState::Canceled:
      return "[-]";
  }
  return "[ ]";
}

bool AssetStudioWidget::isImagePath(const QString& path) const {
  const auto suffix = QFileInfo(path).suffix().toLower();
  return suffix == "png" || suffix == "jpg" || suffix == "jpeg" || suffix == "webp";
}

bool AssetStudioWidget::styleProfileExists() const {
  return QFileInfo(styleProfileJsonPath()).isFile() && QFileInfo(styleProfileMarkdownPath()).isFile();
}

QString AssetStudioWidget::styleProfileDir() const {
  return QString("%1/games/last-hearth/assets_source/style-profiles").arg(remoteRoot_);
}

QString AssetStudioWidget::styleProfileJsonPath() const {
  return QString("%1/last-hearth-style-profile.json").arg(styleProfileDir());
}

QString AssetStudioWidget::styleProfileMarkdownPath() const {
  return QString("%1/last-hearth-style-profile.md").arg(styleProfileDir());
}

QStringList AssetStudioWidget::contactSheetPaths() const {
  return {
      QString("%1/games/last-hearth/assets_source/reviews/environment-contact-sheet.png").arg(remoteRoot_),
      QString("%1/games/last-hearth/assets_source/reviews/core-entities-contact-sheet.png").arg(remoteRoot_),
  };
}

QString AssetStudioWidget::contactSheetArgs() {
  QStringList args;
  for (const auto& path : contactSheetPaths()) {
    if (QFileInfo(path).isFile()) args << QString("--image %1").arg(shellQuote(path));
  }
  if (args.size() < contactSheetPaths().size()) {
    appendLog("Style reference warning: one or more contact sheets are missing; continuing with available references.\n");
  }
  return args.join(' ');
}

QString AssetStudioWidget::styleProfilePrompt() const {
  return QString(
             "Explore the Last Hearth repository and create a cached art direction profile for Asset Studio. "
             "Target style: future painterly Last Hearth source art, not current low-resolution runtime pixel art. "
             "Use the attached contact sheets as visual reference for subject identity, scale, silhouettes, palette restraint, and gameplay readability, "
             "but explicitly distinguish current runtime pixel constraints from the future painterly source-art target. "
             "Read these project sources when present: docs/last-hearth/art-content-pipeline.md, docs/zeus/content-pipeline.md, "
             "games/last-hearth/assets_source/prompts/prototype-prompts.json, games/last-hearth/assets_source/metadata/prototype-assets.metadata.json, "
             "games/last-hearth/assets_source/core-sprite-pack.config.mjs, games/last-hearth/assets_source/environment-sprite-pack.config.mjs, "
             "games/last-hearth/assets_source/last-hearth-pixel-templates.mjs, games/last-hearth/assets_game/atlases/*.atlas.json, "
             "games/last-hearth/content/**/*.json, and approved assets under games/last-hearth/assets_source/approved. "
             "Write files exactly at %1 and %2. The JSON must include styleVersion, targetStyle, currentRuntimeStyle, cameraComposition, palette, lighting, "
             "silhouetteRules, scaleReadabilityRules, forbiddenTraits, domainGuidance, referenceFiles, referenceImages, outputContract, and styleComplianceChecklist. "
             "The Markdown must be a concise human-readable brief. Verify both files exist before your final response.")
      .arg(styleProfileJsonPath(), styleProfileMarkdownPath());
}

void AssetStudioWidget::startStyleProfileRefresh(bool continueGeneration) {
  if (remoteRoot_.trimmed().isEmpty()) {
    appendLog("Remote project path is empty.\n");
    return;
  }
  pendingConceptAfterStyleProfile_ = continueGeneration;
  activeRunPath_ = styleProfileDir();
  const auto command = QString("mkdir -p %1 && cd %2 && codex exec --cd %2 %3 %4 --output-last-message %5 %6")
                           .arg(shellQuote(styleProfileDir()), shellQuote(remoteRoot_), QString(kCodexYoloFlag), contactSheetArgs(),
                                shellQuote(QString("%1/codex-style-profile-final.md").arg(styleProfileDir())), shellQuote(styleProfilePrompt()));
  startRemoteCommand(JobKind::StyleProfile, "Refreshing style profile", command);
}

QString AssetStudioWidget::assetRequestText() const {
  const auto prompt = promptEdit_ ? promptEdit_->toPlainText().trimmed() : QString();
  if (!prompt.isEmpty()) return prompt;
  const auto requestedSlug = slugEdit_ ? slugEdit_->text().trimmed() : QString();
  if (requestedSlug.isEmpty()) return QString();
  const auto domain = domainCombo_ ? domainCombo_->currentText() : QString("asset");
  return QString("%1, %2 asset concepts").arg(requestedSlug, domain);
}

void AssetStudioWidget::refreshRunImages() {
  if (currentRunPath_.isEmpty()) return;
  stopProcess(process_);
  listBuffer_.clear();
  updateStep(RunStep::Verify, StepState::Running, "Checking generated files on disk");
  const auto runPath = activeRunPath_.isEmpty() ? currentRunPath_ : activeRunPath_;
  const auto command = QString("find %1 -maxdepth 1 -type f -printf '%f\\t%p\\t%s\\n' 2>/dev/null | sort").arg(shellQuote(runPath));
  process_ = startCommand(command);
  jobKind_ = JobKind::List;
  setBusy(true, "Verifying generated files");
  connect(process_, &QProcess::readyReadStandardOutput, this, [this]() { listBuffer_.append(process_->readAllStandardOutput()); });
  connect(process_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int, QProcess::ExitStatus) {
    const auto lines = QString::fromUtf8(listBuffer_).split('\n', Qt::SkipEmptyParts);
    listBuffer_.clear();
    stopProcess(process_);
    jobKind_ = JobKind::None;
    clearImages();
    if (lines.isEmpty()) {
      setBusy(false);
      handleMissingRunImages();
      return;
    }
    QList<RunFile> files;
    QStringList presentNames;
    for (const auto& line : lines) {
      const auto fields = line.split('\t');
      if (fields.size() < 3) continue;
      RunFile file{fields[0], fields[1], parseSize(fields[2])};
      files << file;
      presentNames << file.name;
      if (!isImagePath(file.path)) continue;
      auto* item = new QListWidgetItem(file.name);
      item->setData(Qt::UserRole, file.path);
      item->setTextAlignment(Qt::AlignHCenter);
      item->setIcon(editorIcon(EditorIcon::Image, QColor("#475467"), QSize(kThumbSize, kThumbSize)));
      imageList_->addItem(item);
      images_.insert(file.path, {file.path, item});
      thumbnailQueue_ << file.path;
    }
    QStringList missing;
    for (const auto& expected : expectedFilesFor(activeRunKind_)) {
      if (!presentNames.contains(expected)) missing << expected;
    }
    finishRunSummary(files, missing);
    if (!missing.isEmpty()) {
      setBusy(false);
      return;
    }
    updateStep(RunStep::Thumbnails, StepState::Running, QString("Loading %1 previews").arg(thumbnailQueue_.size()));
    setBusy(false);
    loadNextThumbnail();
  });
}

void AssetStudioWidget::loadNextThumbnail() {
  if (thumbnailQueue_.isEmpty()) {
    updateStep(RunStep::Thumbnails, StepState::Done, QString("%1 previews loaded").arg(images_.size()));
    const auto sheetItems = imageList_->findItems("concept-sheet.png", Qt::MatchExactly);
    if (!sheetItems.isEmpty()) imageList_->setCurrentItem(sheetItems.first());
    return;
  }
  stopProcess(thumbnailProcess_);
  thumbnailPath_ = thumbnailQueue_.takeFirst();
  if (useLocalExecution()) {
    if (!loadLocalThumbnail(thumbnailPath_)) {
      const auto it = images_.find(thumbnailPath_);
      if (it != images_.end() && it->item) it->item->setText(QString("%1\nPreview failed").arg(imageName(thumbnailPath_)));
    }
    loadNextThumbnail();
    return;
  }
  thumbnailBuffer_.clear();
  thumbnailProcess_ = ssh_.streamRemoteFile(sshProfile_, thumbnailPath_, this);
  connect(thumbnailProcess_, &QProcess::readyReadStandardOutput, this, [this]() { thumbnailBuffer_.append(thumbnailProcess_->readAllStandardOutput()); });
  connect(thumbnailProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int code, QProcess::ExitStatus) {
    if (code == 0) {
      QImage image;
      if (image.loadFromData(thumbnailBuffer_)) {
        const auto it = images_.find(thumbnailPath_);
        if (it != images_.end() && it->item) {
          it->item->setIcon(QPixmap::fromImage(image).scaled(kThumbSize, kThumbSize, Qt::KeepAspectRatio, Qt::SmoothTransformation));
        }
      } else {
        const auto it = images_.find(thumbnailPath_);
        if (it != images_.end() && it->item) it->item->setText(QString("%1\nPreview failed").arg(imageName(thumbnailPath_)));
      }
    } else {
      const auto it = images_.find(thumbnailPath_);
      if (it != images_.end() && it->item) it->item->setText(QString("%1\nPreview failed").arg(imageName(thumbnailPath_)));
    }
    thumbnailBuffer_.clear();
    stopProcess(thumbnailProcess_);
    loadNextThumbnail();
  });
}

bool AssetStudioWidget::loadLocalThumbnail(const QString& path) {
  QImage image;
  if (!image.load(path)) return false;
  const auto it = images_.find(path);
  if (it != images_.end() && it->item) {
    it->item->setIcon(QPixmap::fromImage(image).scaled(kThumbSize, kThumbSize, Qt::KeepAspectRatio, Qt::SmoothTransformation));
  }
  return true;
}

void AssetStudioWidget::handleMissingRunImages() {
  const auto message = QString("Codex finished but no project images were written to %1. Check the Codex log for a generated_images fallback path.").arg(currentRunPath_);
  appendLog(QString("%1\n").arg(message));
  phaseLabel_->setText("No project images written");
  selectedLabel_->setText(message);
  summaryLabel_->setText(message);
  updateStep(RunStep::Verify, StepState::Failed, "No images found in run folder");
  emit statusMessage("Asset Studio: no project images written");
}

void AssetStudioWidget::clearImages() {
  stopProcess(thumbnailProcess_);
  imageList_->clear();
  images_.clear();
  thumbnailQueue_.clear();
  thumbnailPath_.clear();
  selectedLabel_->setText("No image selected");
}

QString AssetStudioWidget::slug() const {
  return sanitizedSlug(slugEdit_->text());
}

QString AssetStudioWidget::nextRunPath() const {
  return QString("%1/games/last-hearth/assets_source/codex-runs/%2-%3")
      .arg(remoteRoot_, QDateTime::currentDateTimeUtc().toString("yyyyMMdd-HHmmss"), slug());
}

QString AssetStudioWidget::selectedImagePath() const {
  const auto items = imageList_->selectedItems();
  return items.isEmpty() ? QString() : items.first()->data(Qt::UserRole).toString();
}

QString AssetStudioWidget::codexConceptPrompt(const QString& runPath) const {
  return QString(
             "$imagegen Create a concept sheet for a Last Hearth game asset. Slug: %1. User request: %2. Domain: %3. "
             "Before generating, read the cached style profile at %5 and follow it. Target the future painterly Last Hearth source-art style, "
             "using the attached contact sheets only as reference for identity, scale, silhouette, palette restraint, and gameplay readability. "
             "Do not default to generic fantasy, modern survival-game promo art, photorealism, or the current pixel-art runtime look. "
             "Use case: stylized-concept. Asset type: source concept sheet for Last Hearth game art, not final runtime art. "
             "Create four distinct candidates plus a sheet. Save files exactly in %4 as concept-sheet.png, concept-01.png, concept-02.png, concept-03.png, concept-04.png, manifest.json. "
             "You are running with filesystem access; create the run folder if missing, copy the generated PNGs into it with exactly those filenames, "
             "write manifest.json, and verify all six files exist before your final response. Do not leave the generated images only in Codex default output storage. "
             "If any copy or write fails, report the exact generated_images source directory and failed destination. "
             "The JSON manifest must include slug, prompt, files, styleProfilePath, styleVersion, styleSummary, referenceImages, styleComplianceChecklist, styleNotes, targetUse, and reviewChecklist.")
      .arg(slug(), assetRequestText(), domainCombo_->currentText(), runPath, styleProfileJsonPath());
}

QString AssetStudioWidget::codexRefinePrompt(const QString& runPath, const QString& selectedPath) const {
  return QString(
             "$imagegen Refine the attached/selected Last Hearth concept into a runtime-ready PNG candidate. "
             "Slug: %1. Source image: %2. User request: %3. Before generating, read the cached style profile at %5 and follow it. "
             "Target the future painterly Last Hearth source-art style while preserving gameplay readability, strong silhouette, and a transparent/clean background where appropriate. "
             "Save exactly in %4 as refined.png, runtime-candidate.png, candidate.metadata.json, qa.md. "
             "You are running with filesystem access; create the run folder if missing, copy generated PNGs into it with exactly those filenames, "
             "write candidate.metadata.json and qa.md, and verify all four files exist before your final response. "
             "Do not leave the generated images only in Codex default output storage. If any copy or write fails, report the exact generated_images source directory and failed destination. "
             "Metadata must include slug, sourceConcept, prompt, styleProfilePath, styleVersion, styleSummary, referenceImages, styleComplianceChecklist, provenance generated, reviewStatus draft, commercialUseReviewed false, accessibilityNotes, and tags.")
      .arg(slug(), selectedPath, assetRequestText(), runPath, styleProfileJsonPath());
}

QString AssetStudioWidget::packCommand() const {
  const auto pack = packCombo_->currentText();
  if (pack == "core sprites") return "npm run sprites:pack";
  if (pack == "environment") return "npm run environment:pack";
  return "true";
}

QString AssetStudioWidget::promotedRelativePath() const {
  const auto configured = promotePathEdit_->text().trimmed();
  if (!configured.isEmpty()) return configured;
  if (domainCombo_->currentText() == "loose runtime") return QString("games/last-hearth/assets_game/sprites/%1.png").arg(slug());
  if (domainCombo_->currentText() == "environment") return QString("games/last-hearth/assets_source/approved/environment/%1.png").arg(slug());
  return QString("games/last-hearth/assets_source/approved/core-entities/%1.png").arg(slug());
}
