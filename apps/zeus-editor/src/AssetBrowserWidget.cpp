#include "AssetBrowserWidget.h"

#include "EditorIcons.h"

#include <QAbstractItemView>
#include <QFileInfo>
#include <QFrame>
#include <QGridLayout>
#include <QIcon>
#include <QImage>
#include <QLabel>
#include <QLineEdit>
#include <QListView>
#include <QListWidget>
#include <QPixmap>
#include <QScrollArea>
#include <QSplitter>
#include <QSize>
#include <QTextEdit>
#include <QToolButton>
#include <QVBoxLayout>

namespace {

constexpr int kMaxAssets = 240;
constexpr int kThumbSize = 120;

QString assetNameFromPath(const QString& path) {
  return QFileInfo(path).fileName();
}

bool isImageExtension(const QString& path) {
  const auto suffix = QFileInfo(path).suffix().toLower();
  return suffix == "png" || suffix == "jpg" || suffix == "jpeg" || suffix == "webp" || suffix == "gif" || suffix == "bmp";
}

QString buildAssetListCommand(const QString& root, const QStringList& ignore) {
  QStringList pruneParts;
  pruneParts.reserve(ignore.size());
  for (const auto& entry : ignore) {
    if (entry.trimmed().isEmpty()) continue;
    pruneParts << QString("-path %1").arg(shellQuote(QString("*/%1").arg(entry)));
  }

  const auto pruneClause = pruneParts.isEmpty() ? QString() : QString("( %1 ) -prune -o ").arg(pruneParts.join(" -o "));
  return QString(
             "find %1 %2-type f \\( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.gif' -o -iname '*.bmp' \\) "
             "-printf '%%p\\t%%s\\t%%TY-%%Tm-%%Td %%TH:%%TM\\n' 2>/dev/null | head -n %3")
      .arg(shellQuote(root), pruneClause, QString::number(kMaxAssets));
}

QPixmap scaledPixmap(const QImage& image, int maxSize) {
  return QPixmap::fromImage(image).scaled(maxSize, maxSize, Qt::KeepAspectRatio, Qt::SmoothTransformation);
}

void stopProcess(QProcess*& process) {
  if (!process) return;
  process->disconnect();
  if (process->state() != QProcess::NotRunning) {
    process->terminate();
    if (!process->waitForFinished(1000)) process->kill();
  }
  process->deleteLater();
  process = nullptr;
}

}  // namespace

AssetBrowserWidget::AssetBrowserWidget(QWidget* parent) : QWidget(parent) {
  buildUi();
}

AssetBrowserWidget::~AssetBrowserWidget() {
  clearProcesses();
}

void AssetBrowserWidget::setContext(const SshProfile& ssh, const QString& remoteRoot, const QStringList& ignore) {
  sshProfile_ = ssh;
  remoteRoot_ = remoteRoot;
  ignore_ = ignore;
}

void AssetBrowserWidget::refresh() {
  loadAssetList();
}

void AssetBrowserWidget::requestFocusBrowser() {
  if (grid_) grid_->setFocus();
}

void AssetBrowserWidget::handleRefreshClicked() {
  refresh();
}

void AssetBrowserWidget::handleSearchChanged(const QString& text) {
  searchText_ = text.trimmed().toLower();
  applyFilter();
}

void AssetBrowserWidget::handleSelectionChanged() {
  loadSelectedAsset();
}

void AssetBrowserWidget::handleListReadyRead() {
  listBuffer_.append(listProcess_->readAllStandardOutput());
}

void AssetBrowserWidget::handleListFinished(int code, QProcess::ExitStatus status) {
  Q_UNUSED(status);
  loadingList_ = false;

  const auto output = QString::fromUtf8(listBuffer_);
  listBuffer_.clear();
  if (code != 0 && output.trimmed().isEmpty()) {
    appendStatus(QString("Asset scan failed: %1").arg(code));
    showPreviewPlaceholder("Asset scan failed.");
    return;
  }

  clearGrid();
  entries_.clear();
  thumbnailQueue_.clear();

  const auto lines = output.split('\n', Qt::SkipEmptyParts);
  for (const auto& line : lines) {
    const auto fields = line.split('\t');
    if (fields.size() < 3) continue;

    AssetEntry entry;
    entry.path = fields[0];
    entry.name = assetNameFromPath(entry.path);
    entry.sizeText = fields[1];
    entry.modifiedText = fields[2];
    entry.isImage = isImageExtension(entry.path);
    entry.item = new QListWidgetItem(entry.name);
    entry.item->setData(Qt::UserRole, entry.path);
    entry.item->setData(Qt::UserRole + 1, entry.sizeText);
    entry.item->setData(Qt::UserRole + 2, entry.modifiedText);
    entry.item->setData(Qt::UserRole + 3, entry.isImage);
    entry.item->setTextAlignment(Qt::AlignHCenter);
    entry.item->setToolTip(entry.path);
    entry.item->setIcon(editorIcon(entry.isImage ? EditorIcon::Image : EditorIcon::File, QColor("#475467"), QSize(kThumbSize, kThumbSize)));

    entries_.insert(entry.path, entry);
    grid_->addItem(entry.item);
    if (entry.isImage) thumbnailQueue_ << entry.path;
  }

  applyFilter();
  appendStatus(QString("Found %1 assets").arg(entries_.size()));
  startNextThumbnail();
}

void AssetBrowserWidget::handleListError(QProcess::ProcessError error) {
  Q_UNUSED(error);
  loadingList_ = false;
  appendStatus("Asset scan error");
}

void AssetBrowserWidget::handleThumbnailReadyRead() {
  thumbnailBuffer_.append(thumbnailProcess_->readAllStandardOutput());
}

void AssetBrowserWidget::handleThumbnailFinished(int code, QProcess::ExitStatus status) {
  Q_UNUSED(status);
  const auto path = thumbnailPath_;
  thumbnailPath_.clear();

  const auto data = thumbnailBuffer_;
  thumbnailBuffer_.clear();
  stopProcess(thumbnailProcess_);

  if (code == 0) updateItemThumbnail(path, data);
  startNextThumbnail();
}

void AssetBrowserWidget::handleThumbnailError(QProcess::ProcessError error) {
  Q_UNUSED(error);
  thumbnailPath_.clear();
  thumbnailBuffer_.clear();
  stopProcess(thumbnailProcess_);
  startNextThumbnail();
}

void AssetBrowserWidget::handleDetailReadyRead() {
  detailBuffer_.append(detailProcess_->readAllStandardOutput());
}

void AssetBrowserWidget::handleDetailFinished(int code, QProcess::ExitStatus status) {
  Q_UNUSED(status);
  const auto path = detailPath_;
  detailPath_.clear();

  const auto data = detailBuffer_;
  detailBuffer_.clear();
  stopProcess(detailProcess_);
  loadingDetail_ = false;

  if (code != 0) {
    showPreviewPlaceholder("Unable to load asset.");
    metadataText_->setPlainText(QString("Path: %1\nPreview failed.").arg(path));
    return;
  }

  QImage image;
  if (!image.loadFromData(data)) {
    showPreviewPlaceholder("No raster preview available.");
    metadataText_->setPlainText(QString("Path: %1\nBinary file preview not available.").arg(path));
    return;
  }

  const auto pixmap = scaledPixmap(image, 1400);
  previewImage_->setPixmap(pixmap);
  previewImage_->setFixedSize(pixmap.size());
  previewImage_->setText(QString());

  const auto it = entries_.find(path);
  const auto sizeText = it == entries_.end() ? QString() : it->sizeText;
  const auto modifiedText = it == entries_.end() ? QString() : it->modifiedText;
  metadataText_->setPlainText(QString("Path: %1\nSize: %2 bytes\nModified: %3\nDimensions: %4 x %5")
                                 .arg(path)
                                 .arg(sizeText)
                                 .arg(modifiedText)
                                 .arg(image.width())
                                 .arg(image.height()));
  previewTitle_->setText(assetNameFromPath(path));
}

void AssetBrowserWidget::handleDetailError(QProcess::ProcessError error) {
  Q_UNUSED(error);
  stopProcess(detailProcess_);
  loadingDetail_ = false;
  showPreviewPlaceholder("Unable to load asset.");
}

void AssetBrowserWidget::buildUi() {
  auto* root = new QVBoxLayout(this);
  root->setContentsMargins(0, 0, 0, 0);
  root->setSpacing(8);

  auto* controls = new QGridLayout();
  controls->setContentsMargins(0, 0, 0, 0);
  controls->setHorizontalSpacing(8);
  controls->setVerticalSpacing(6);

  searchEdit_ = new QLineEdit(this);
  searchEdit_->setPlaceholderText("Search assets");
  refreshButton_ = new QToolButton(this);
  refreshButton_->setAutoRaise(true);
  refreshButton_->setToolButtonStyle(Qt::ToolButtonIconOnly);
  refreshButton_->setIcon(editorIcon(EditorIcon::Refresh));
  refreshButton_->setIconSize(QSize(18, 18));
  refreshButton_->setFixedSize(32, 32);
  refreshButton_->setToolTip("Refresh assets");
  statusLabel_ = new QLabel(this);
  statusLabel_->setMinimumWidth(180);
  statusLabel_->setAlignment(Qt::AlignRight | Qt::AlignVCenter);

  controls->addWidget(new QLabel("Assets", this), 0, 0);
  controls->addWidget(searchEdit_, 0, 1);
  controls->addWidget(refreshButton_, 0, 2);
  controls->addWidget(statusLabel_, 0, 3);

  auto* splitter = new QSplitter(Qt::Horizontal, this);
  grid_ = new QListWidget(splitter);
  grid_->setViewMode(QListView::IconMode);
  grid_->setResizeMode(QListView::Adjust);
  grid_->setMovement(QListView::Static);
  grid_->setWrapping(true);
  grid_->setSpacing(10);
  grid_->setSelectionMode(QAbstractItemView::SingleSelection);
  grid_->setIconSize(QSize(kThumbSize, kThumbSize));
  grid_->setGridSize(QSize(kThumbSize + 48, kThumbSize + 72));
  grid_->setUniformItemSizes(true);
  grid_->setWordWrap(true);

  auto* detailPane = new QWidget(splitter);
  auto* detailLayout = new QVBoxLayout(detailPane);
  detailLayout->setContentsMargins(0, 0, 0, 0);
  detailLayout->setSpacing(6);

  previewTitle_ = new QLabel("No asset selected", detailPane);
  previewTitle_->setObjectName("panelHeading");
  previewTitle_->setTextInteractionFlags(Qt::TextSelectableByMouse);

  previewScroll_ = new QScrollArea(detailPane);
  previewScroll_->setWidgetResizable(true);
  previewScroll_->setFrameShape(QFrame::StyledPanel);
  previewImage_ = new QLabel(previewScroll_);
  previewImage_->setObjectName("assetPreview");
  previewImage_->setAlignment(Qt::AlignCenter);
  previewImage_->setMinimumSize(360, 260);
  previewImage_->setText("Select an asset");
  previewScroll_->setWidget(previewImage_);

  metadataText_ = new QTextEdit(detailPane);
  metadataText_->setReadOnly(true);
  metadataText_->setMinimumHeight(140);

  detailLayout->addWidget(previewTitle_);
  detailLayout->addWidget(previewScroll_, 1);
  detailLayout->addWidget(metadataText_);

  splitter->setStretchFactor(0, 2);
  splitter->setStretchFactor(1, 3);

  root->addLayout(controls);
  root->addWidget(splitter, 1);

  connect(refreshButton_, &QToolButton::clicked, this, &AssetBrowserWidget::handleRefreshClicked);
  connect(searchEdit_, &QLineEdit::textChanged, this, &AssetBrowserWidget::handleSearchChanged);
  connect(grid_, &QListWidget::itemSelectionChanged, this, &AssetBrowserWidget::handleSelectionChanged);

  showPreviewPlaceholder("Select an asset");
  appendStatus("Idle");
}

void AssetBrowserWidget::loadAssetList() {
  clearProcesses();
  clearGrid();
  entries_.clear();
  thumbnailQueue_.clear();
  listBuffer_.clear();
  detailBuffer_.clear();
  thumbnailBuffer_.clear();
  detailPath_.clear();
  thumbnailPath_.clear();
  loadingList_ = true;
  loadingThumbnails_ = false;
  loadingDetail_ = false;

  if (remoteRoot_.isEmpty()) {
    appendStatus("No remote root set");
    showPreviewPlaceholder("No project path set.");
    return;
  }

  appendStatus("Scanning assets...");
  listProcess_ = ssh_.runRemoteCommand(sshProfile_, buildAssetListCommand(remoteRoot_, ignore_), this);
  connect(listProcess_, &QProcess::readyReadStandardOutput, this, &AssetBrowserWidget::handleListReadyRead);
  connect(listProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, &AssetBrowserWidget::handleListFinished);
  connect(listProcess_, &QProcess::errorOccurred, this, &AssetBrowserWidget::handleListError);
}

void AssetBrowserWidget::startNextThumbnail() {
  if (thumbnailQueue_.isEmpty()) {
    loadingThumbnails_ = false;
    appendStatus(QString("Loaded %1 assets").arg(entries_.size()));
    return;
  }

  const auto path = thumbnailQueue_.takeFirst();
  const auto it = entries_.find(path);
  if (it == entries_.end() || !it->isImage) {
    startNextThumbnail();
    return;
  }

  thumbnailPath_ = path;
  thumbnailBuffer_.clear();
  loadingThumbnails_ = true;
  thumbnailProcess_ = ssh_.streamRemoteFile(sshProfile_, path, this);
  connect(thumbnailProcess_, &QProcess::readyReadStandardOutput, this, &AssetBrowserWidget::handleThumbnailReadyRead);
  connect(thumbnailProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, &AssetBrowserWidget::handleThumbnailFinished);
  connect(thumbnailProcess_, &QProcess::errorOccurred, this, &AssetBrowserWidget::handleThumbnailError);
}

void AssetBrowserWidget::loadSelectedAsset() {
  const auto items = grid_->selectedItems();
  if (items.isEmpty()) return;

  const auto* item = items.first();
  const auto path = item->data(Qt::UserRole).toString();
  if (path.isEmpty()) return;

  stopProcess(detailProcess_);
  detailBuffer_.clear();
  detailPath_ = path;
  loadingDetail_ = true;
  showPreviewPlaceholder(QString("Loading %1...").arg(assetNameFromPath(path)));
  metadataText_->setPlainText(QString("Path: %1\nLoading...").arg(path));

  detailProcess_ = ssh_.streamRemoteFile(sshProfile_, path, this);
  connect(detailProcess_, &QProcess::readyReadStandardOutput, this, &AssetBrowserWidget::handleDetailReadyRead);
  connect(detailProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, &AssetBrowserWidget::handleDetailFinished);
  connect(detailProcess_, &QProcess::errorOccurred, this, &AssetBrowserWidget::handleDetailError);
}

void AssetBrowserWidget::clearProcesses() {
  stopProcess(listProcess_);
  stopProcess(thumbnailProcess_);
  stopProcess(detailProcess_);
}

void AssetBrowserWidget::clearGrid() {
  if (grid_) grid_->clear();
}

void AssetBrowserWidget::applyFilter() {
  if (!grid_) return;
  for (int i = 0; i < grid_->count(); ++i) {
    auto* item = grid_->item(i);
    const auto path = item->data(Qt::UserRole).toString().toLower();
    const auto name = assetNameFromPath(path).toLower();
    const auto visible = searchText_.isEmpty() || path.contains(searchText_) || name.contains(searchText_);
    item->setHidden(!visible);
  }
}

void AssetBrowserWidget::appendStatus(const QString& message) {
  if (statusLabel_) statusLabel_->setText(message);
}

void AssetBrowserWidget::showPreviewPlaceholder(const QString& text) {
  if (previewImage_) {
    previewImage_->clear();
    previewImage_->setText(text);
    previewImage_->setFixedSize(360, 260);
  }
  if (previewTitle_) previewTitle_->setText(text);
}

QString AssetBrowserWidget::assetListCommand() const {
  return buildAssetListCommand(remoteRoot_, ignore_);
}

void AssetBrowserWidget::updateItemThumbnail(const QString& path, const QByteArray& data) {
  const auto it = entries_.find(path);
  if (it == entries_.end() || !it->item) return;

  QImage image;
  if (!image.loadFromData(data)) return;

  it->item->setIcon(QIcon(scaledPixmap(image, kThumbSize)));
  it->item->setText(QString("%1\n%2").arg(it->name, it->sizeText));
  it->item->setData(Qt::UserRole + 4, QSize(image.width(), image.height()));
}

const AssetBrowserWidget::AssetEntry* AssetBrowserWidget::entryForPath(const QString& path) const {
  const auto it = entries_.find(path);
  return it == entries_.end() ? nullptr : &it.value();
}
