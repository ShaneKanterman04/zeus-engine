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

namespace {

constexpr int kThumbSize = 160;

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

void AssetStudioWidget::generateConcepts() {
  if (process_) return;
  if (assetRequestText().trimmed().isEmpty()) {
    appendLog("Enter an asset prompt or slug before generating concepts.\n");
    phaseLabel_->setText("Needs asset prompt");
    emit statusMessage("Asset Studio needs an asset prompt");
    updateGenerateState();
    return;
  }
  currentRunPath_ = nextRunPath();
  refinedPath_.clear();
  clearImages();
  const auto command = QString("mkdir -p %1 && cd %2 && codex exec --cd %2 --sandbox workspace-write --output-last-message %3 %4")
                           .arg(shellQuote(currentRunPath_), shellQuote(remoteRoot_), shellQuote(QString("%1/codex-final.md").arg(currentRunPath_)), shellQuote(codexConceptPrompt(currentRunPath_)));
  startRemoteCommand(JobKind::Concepts, "Generating concept sheet", command);
}

void AssetStudioWidget::refineSelected() {
  const auto selectedPath = selectedImagePath();
  if (process_ || selectedPath.isEmpty()) return;
  const auto refineRunPath = QString("%1/refine-%2").arg(currentRunPath_, QDateTime::currentDateTimeUtc().toString("HHmmss"));
  refinedPath_ = QString("%1/runtime-candidate.png").arg(refineRunPath);
  const auto command = QString("mkdir -p %1 && cd %2 && codex exec --cd %2 --sandbox workspace-write --image %3 --output-last-message %4 %5")
                           .arg(shellQuote(refineRunPath), shellQuote(remoteRoot_), shellQuote(selectedPath), shellQuote(QString("%1/codex-final.md").arg(refineRunPath)), shellQuote(codexRefinePrompt(refineRunPath, selectedPath)));
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
  refineButton_ = new QPushButton("Refine Selected", this);
  promoteButton_ = new QPushButton("Promote", this);
  packButton_ = new QPushButton("Pack + Validate", this);
  cancelButton_ = new QPushButton("Cancel", this);
  refineButton_->setEnabled(false);
  promoteButton_->setEnabled(false);
  generateButton_->setEnabled(false);
  cancelButton_->setEnabled(false);
  buttons->addWidget(generateButton_);
  buttons->addWidget(refineButton_);
  buttons->addWidget(promoteButton_);
  buttons->addWidget(packButton_);
  buttons->addStretch(1);
  buttons->addWidget(cancelButton_);

  phaseLabel_ = new QLabel("Idle", this);
  phaseLabel_->setObjectName("panelHeading");
  selectedLabel_ = new QLabel("No image selected", this);
  selectedLabel_->setTextInteractionFlags(Qt::TextSelectableByMouse);

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
  root->addWidget(selectedLabel_);
  root->addLayout(body, 1);

  connect(generateButton_, &QPushButton::clicked, this, &AssetStudioWidget::generateConcepts);
  connect(refineButton_, &QPushButton::clicked, this, &AssetStudioWidget::refineSelected);
  connect(promoteButton_, &QPushButton::clicked, this, &AssetStudioWidget::promoteSelected);
  connect(packButton_, &QPushButton::clicked, this, &AssetStudioWidget::runPackAndValidate);
  connect(cancelButton_, &QPushButton::clicked, this, &AssetStudioWidget::cancelJob);
  connect(imageList_, &QListWidget::itemSelectionChanged, this, &AssetStudioWidget::handleSelectionChanged);
  connect(slugEdit_, &QLineEdit::textChanged, this, &AssetStudioWidget::updateGenerateState);
  connect(promptEdit_, &QTextEdit::textChanged, this, &AssetStudioWidget::updateGenerateState);
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
  process_ = startCommand(command);
  setBusy(true, label);
  appendLog(QString("\n[%1] %2\n%3\n").arg(QDateTime::currentDateTime().toString("HH:mm:ss"), label, command));
  connect(process_, &QProcess::readyRead, this, [this]() { appendLog(QString::fromUtf8(process_->readAll())); });
  connect(process_, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
    appendLog(QString("Process error: %1\n").arg(error));
  });
  connect(process_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, &AssetStudioWidget::finishJob);
  emit statusMessage(label);
}

void AssetStudioWidget::finishJob(int code, QProcess::ExitStatus status) {
  const auto finishedKind = jobKind_;
  appendLog(QString("\nFinished: code=%1 status=%2\n").arg(code).arg(status));
  stopProcess(process_);
  jobKind_ = JobKind::None;
  setBusy(false);
  if ((finishedKind == JobKind::Concepts || finishedKind == JobKind::Refine) && code == 0) refreshRunImages();
  if ((finishedKind == JobKind::Promote || finishedKind == JobKind::PackValidate) && code == 0) emit assetsChanged();
  emit statusMessage(code == 0 ? "Asset Studio ready" : "Asset Studio job failed");
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

void AssetStudioWidget::setBusy(bool busy, const QString& label) {
  updateGenerateState();
  packButton_->setEnabled(!busy);
  cancelButton_->setEnabled(busy);
  phaseLabel_->setText(busy ? QString("%1... this can take a while").arg(label) : "Idle");
  handleSelectionChanged();
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
  const auto command = QString("find %1 -type f \\( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \\) -printf '%%p\\n' 2>/dev/null | sort").arg(shellQuote(currentRunPath_));
  process_ = startCommand(command);
  jobKind_ = JobKind::List;
  setBusy(true, "Loading generated images");
  connect(process_, &QProcess::readyReadStandardOutput, this, [this]() { listBuffer_.append(process_->readAllStandardOutput()); });
  connect(process_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int, QProcess::ExitStatus) {
    const auto lines = QString::fromUtf8(listBuffer_).split('\n', Qt::SkipEmptyParts);
    listBuffer_.clear();
    stopProcess(process_);
    jobKind_ = JobKind::None;
    clearImages();
    for (const auto& line : lines) {
      auto* item = new QListWidgetItem(imageName(line));
      item->setData(Qt::UserRole, line);
      item->setTextAlignment(Qt::AlignHCenter);
      item->setIcon(editorIcon(EditorIcon::Image, QColor("#475467"), QSize(kThumbSize, kThumbSize)));
      imageList_->addItem(item);
      images_.insert(line, {line, item});
      thumbnailQueue_ << line;
    }
    setBusy(false);
    loadNextThumbnail();
  });
}

void AssetStudioWidget::loadNextThumbnail() {
  if (thumbnailQueue_.isEmpty()) return;
  stopProcess(thumbnailProcess_);
  thumbnailPath_ = thumbnailQueue_.takeFirst();
  if (useLocalExecution()) {
    loadLocalThumbnail(thumbnailPath_);
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
      }
    }
    thumbnailBuffer_.clear();
    stopProcess(thumbnailProcess_);
    loadNextThumbnail();
  });
}

void AssetStudioWidget::loadLocalThumbnail(const QString& path) {
  QImage image;
  if (!image.load(path)) return;
  const auto it = images_.find(path);
  if (it != images_.end() && it->item) {
    it->item->setIcon(QPixmap::fromImage(image).scaled(kThumbSize, kThumbSize, Qt::KeepAspectRatio, Qt::SmoothTransformation));
  }
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
             "Style: cold late-autumn frontier survival, readable gameplay silhouette, no text, no watermark. "
             "Use case: stylized-concept. Asset type: source concept sheet for Last Hearth game art, not final runtime art. "
             "Create four distinct candidates plus a sheet. Save files exactly in %4 as concept-sheet.png, concept-01.png, concept-02.png, concept-03.png, concept-04.png, manifest.json. "
             "Do not leave the generated images only in Codex default output storage; copy the project-bound PNGs into the requested run folder. "
             "The JSON manifest must include slug, prompt, files, styleNotes, targetUse, and reviewChecklist.")
      .arg(slug(), assetRequestText(), domainCombo_->currentText(), runPath);
}

QString AssetStudioWidget::codexRefinePrompt(const QString& runPath, const QString& selectedPath) const {
  return QString(
             "$imagegen Refine the attached/selected Last Hearth concept into a runtime-ready PNG candidate. "
             "Slug: %1. Source image: %2. User request: %3. Preserve strong silhouette and transparent/clean background where appropriate. "
             "Save exactly in %4 as refined.png, runtime-candidate.png, candidate.metadata.json, qa.md. "
             "Do not leave the generated images only in Codex default output storage; copy the project-bound PNGs into the requested run folder. "
             "Metadata must include slug, sourceConcept, prompt, provenance generated, reviewStatus draft, commercialUseReviewed false, accessibilityNotes, and tags.")
      .arg(slug(), selectedPath, assetRequestText(), runPath);
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
