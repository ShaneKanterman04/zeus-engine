#include "RemoteExplorerWidget.h"

#include "EditorIcons.h"

#include <QAbstractItemView>
#include <QFileInfo>
#include <QFont>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QToolButton>
#include <QTreeWidget>
#include <QTreeWidgetItem>
#include <QSize>
#include <QVBoxLayout>
#include <algorithm>

namespace {

enum Columns { NameColumn = 0 };

QString humanSize(const QString& bytesText) {
  bool ok = false;
  double bytes = bytesText.toDouble(&ok);
  if (!ok) return bytesText;
  const QStringList units = {"B", "KB", "MB", "GB"};
  int unit = 0;
  while (bytes >= 1024.0 && unit < units.size() - 1) {
    bytes /= 1024.0;
    unit += 1;
  }
  return QString("%1 %2").arg(bytes, 0, unit == 0 ? 'f' : 'f', unit == 0 ? 0 : 1).arg(units[unit]);
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

RemoteExplorerWidget::RemoteExplorerWidget(QWidget* parent) : QWidget(parent) {
  buildUi();
}

RemoteExplorerWidget::~RemoteExplorerWidget() {
  clearProcesses();
}

void RemoteExplorerWidget::setContext(const SshProfile& ssh, const QString& remoteRoot, const QStringList& ignore) {
  const auto rootChanged = remoteRoot_ != remoteRoot;
  sshProfile_ = ssh;
  remoteRoot_ = remoteRoot;
  ignore_ = ignore;
  if (rootChanged || currentPath_.isEmpty() || !currentPath_.startsWith(remoteRoot_)) {
    currentPath_ = remoteRoot_;
    backStack_.clear();
    forwardStack_.clear();
  }
  setPathText(currentPath_);
  updateNavigationButtons();
}

void RemoteExplorerWidget::refresh() {
  loadDirectory(currentPath_.isEmpty() ? remoteRoot_ : currentPath_, false);
}

QString RemoteExplorerWidget::currentPath() const {
  return currentPath_;
}

void RemoteExplorerWidget::requestFocusExplorer() {
  if (tree_) tree_->setFocus();
}

void RemoteExplorerWidget::handleRefreshClicked() {
  refresh();
}

void RemoteExplorerWidget::handleUpClicked() {
  if (currentPath_.isEmpty()) return;
  const auto parent = QFileInfo(currentPath_).absolutePath();
  loadDirectory(parent, true);
}

void RemoteExplorerWidget::handleBackClicked() {
  if (backStack_.isEmpty()) return;
  forwardStack_.prepend(currentPath_);
  const auto previous = backStack_.takeLast();
  loadDirectory(previous, false);
}

void RemoteExplorerWidget::handleForwardClicked() {
  if (forwardStack_.isEmpty()) return;
  backStack_ << currentPath_;
  const auto next = forwardStack_.takeFirst();
  loadDirectory(next, false);
}

void RemoteExplorerWidget::handlePathEdited() {
  const auto path = pathEdit_ ? pathEdit_->text().trimmed() : QString();
  if (!path.isEmpty()) loadDirectory(path, true);
}

void RemoteExplorerWidget::handleSearchChanged(const QString& text) {
  searchText_ = text.trimmed().toLower();
  applyFilter();
}

void RemoteExplorerWidget::handleTreeItemActivated(QTreeWidgetItem* item, int column) {
  Q_UNUSED(column);
  if (!item) return;
  const auto path = item->data(NameColumn, Qt::UserRole).toString();
  const auto kind = item->data(NameColumn, Qt::UserRole + 1).toString();
  if (path.isEmpty()) return;
  if (isDirectoryKind(kind)) {
    loadDirectory(path, true);
    return;
  }
  emit fileActivated(path);
}

void RemoteExplorerWidget::handleListReadyRead() {
  listBuffer_.append(listProcess_->readAllStandardOutput());
}

void RemoteExplorerWidget::handleListFinished(int code, QProcess::ExitStatus status) {
  Q_UNUSED(status);
  const auto output = QString::fromUtf8(listBuffer_);
  listBuffer_.clear();
  stopProcess(listProcess_);

  if (code != 0 && output.trimmed().isEmpty()) {
    appendStatus(QString("Failed to open %1").arg(currentPath_));
    emit statusMessage(QString("Failed to open %1").arg(currentPath_));
    clearEntries();
    return;
  }

  populateDirectory(output);
  appendStatus(QString("Browsing %1").arg(currentPath_));
  emit directoryChanged(currentPath_);
}

void RemoteExplorerWidget::handleListError(QProcess::ProcessError error) {
  Q_UNUSED(error);
  stopProcess(listProcess_);
  appendStatus("Directory load failed");
}

void RemoteExplorerWidget::buildUi() {
  setObjectName("remoteExplorer");

  auto* root = new QVBoxLayout(this);
  root->setContentsMargins(0, 0, 0, 0);
  root->setSpacing(8);

  auto* navRow = new QHBoxLayout();
  navRow->setContentsMargins(0, 0, 0, 0);
  navRow->setSpacing(6);

  backButton_ = new QToolButton(this);
  backButton_->setAutoRaise(true);
  backButton_->setToolButtonStyle(Qt::ToolButtonIconOnly);
  backButton_->setIcon(editorIcon(EditorIcon::ArrowBack));
  backButton_->setIconSize(QSize(18, 18));
  backButton_->setFixedSize(32, 32);
  backButton_->setToolTip("Back");
  forwardButton_ = new QToolButton(this);
  forwardButton_->setAutoRaise(true);
  forwardButton_->setToolButtonStyle(Qt::ToolButtonIconOnly);
  forwardButton_->setIcon(editorIcon(EditorIcon::ArrowForward));
  forwardButton_->setIconSize(QSize(18, 18));
  forwardButton_->setFixedSize(32, 32);
  forwardButton_->setToolTip("Forward");
  upButton_ = new QToolButton(this);
  upButton_->setAutoRaise(true);
  upButton_->setToolButtonStyle(Qt::ToolButtonIconOnly);
  upButton_->setIcon(editorIcon(EditorIcon::ArrowUp));
  upButton_->setIconSize(QSize(18, 18));
  upButton_->setFixedSize(32, 32);
  upButton_->setToolTip("Up");
  refreshButton_ = new QToolButton(this);
  refreshButton_->setAutoRaise(true);
  refreshButton_->setToolButtonStyle(Qt::ToolButtonIconOnly);
  refreshButton_->setIcon(editorIcon(EditorIcon::Refresh));
  refreshButton_->setIconSize(QSize(18, 18));
  refreshButton_->setFixedSize(32, 32);
  refreshButton_->setToolTip("Refresh");
  pathEdit_ = new QLineEdit(this);
  pathEdit_->setClearButtonEnabled(true);
  pathEdit_->setPlaceholderText("Path");
  searchEdit_ = new QLineEdit(this);
  searchEdit_->setPlaceholderText("Search");
  statusLabel_ = new QLabel(this);
  statusLabel_->setMinimumWidth(180);
  statusLabel_->setAlignment(Qt::AlignRight | Qt::AlignVCenter);

  navRow->addWidget(backButton_);
  navRow->addWidget(forwardButton_);
  navRow->addWidget(upButton_);
  navRow->addWidget(refreshButton_);
  navRow->addWidget(pathEdit_, 1);
  navRow->addWidget(searchEdit_);
  navRow->addWidget(statusLabel_);

  tree_ = new QTreeWidget(this);
  tree_->setHeaderHidden(true);
  tree_->setRootIsDecorated(false);
  tree_->setIndentation(16);
  tree_->setIconSize(QSize(16, 16));
  tree_->setUniformRowHeights(true);
  tree_->setSelectionBehavior(QAbstractItemView::SelectRows);
  tree_->setSelectionMode(QAbstractItemView::SingleSelection);
  tree_->setEditTriggers(QAbstractItemView::NoEditTriggers);
  tree_->setSortingEnabled(false);
  tree_->setAlternatingRowColors(true);
  tree_->setAllColumnsShowFocus(true);

  root->addLayout(navRow);
  root->addWidget(tree_, 1);

  connect(backButton_, &QToolButton::clicked, this, &RemoteExplorerWidget::handleBackClicked);
  connect(forwardButton_, &QToolButton::clicked, this, &RemoteExplorerWidget::handleForwardClicked);
  connect(upButton_, &QToolButton::clicked, this, &RemoteExplorerWidget::handleUpClicked);
  connect(refreshButton_, &QToolButton::clicked, this, &RemoteExplorerWidget::handleRefreshClicked);
  connect(pathEdit_, &QLineEdit::returnPressed, this, &RemoteExplorerWidget::handlePathEdited);
  connect(searchEdit_, &QLineEdit::textChanged, this, &RemoteExplorerWidget::handleSearchChanged);
  connect(tree_, &QTreeWidget::itemActivated, this, &RemoteExplorerWidget::handleTreeItemActivated);

  setStyleSheet(R"(
    #remoteExplorer QToolButton {
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 4px;
    }
    #remoteExplorer QToolButton:hover {
      background: palette(alternate-base);
      border-color: palette(mid);
    }
    #remoteExplorer QLineEdit {
      border: 1px solid palette(mid);
      border-radius: 6px;
      padding: 4px 8px;
      background: palette(base);
    }
    #remoteExplorer QTreeWidget {
      border: 1px solid palette(mid);
      border-radius: 8px;
      background: palette(base);
      selection-background-color: palette(highlight);
      selection-color: palette(highlighted-text);
    }
    #remoteExplorer QTreeWidget::item {
      height: 24px;
      padding: 0 6px;
    }
    #remoteExplorer QTreeWidget::item:hover {
      background: palette(alternate-base);
    }
    #remoteExplorer QTreeWidget::item:selected {
      background: palette(highlight);
      color: palette(highlighted-text);
    }
  )");

  appendStatus("Idle");
}

void RemoteExplorerWidget::loadDirectory(const QString& path, bool pushHistory) {
  const auto normalized = QFileInfo(path).absoluteFilePath();
  if (normalized == currentPath_) pushHistory = false;
  if (pushHistory && !currentPath_.isEmpty() && normalized != currentPath_) {
    backStack_ << currentPath_;
    forwardStack_.clear();
  }

  stopProcess(listProcess_);
  clearEntries();
  currentPath_ = normalized;
  setPathText(currentPath_);
  updateNavigationButtons();
  appendStatus(QString("Loading %1").arg(currentPath_));
  emit statusMessage(QString("Loading %1").arg(currentPath_));

  listProcess_ = ssh_.runRemoteCommand(sshProfile_, ssh_.listDirectoryCommand(currentPath_, ignore_), this);
  connect(listProcess_, &QProcess::readyReadStandardOutput, this, &RemoteExplorerWidget::handleListReadyRead);
  connect(listProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, &RemoteExplorerWidget::handleListFinished);
  connect(listProcess_, &QProcess::errorOccurred, this, &RemoteExplorerWidget::handleListError);
}

void RemoteExplorerWidget::clearEntries() {
  if (!tree_) return;
  tree_->clear();
  entries_.clear();
}

void RemoteExplorerWidget::clearProcesses() {
  stopProcess(listProcess_);
}

void RemoteExplorerWidget::applyFilter() {
  if (!tree_) return;
  for (int row = 0; row < tree_->topLevelItemCount(); ++row) {
    auto* item = tree_->topLevelItem(row);
    const auto name = item ? item->text(NameColumn).toLower() : QString();
    const auto path = item ? item->data(NameColumn, Qt::UserRole).toString().toLower() : QString();
    const auto show = searchText_.isEmpty() || name.contains(searchText_) || path.contains(searchText_);
    if (item) item->setHidden(!show);
  }
}

void RemoteExplorerWidget::updateNavigationButtons() {
  if (backButton_) backButton_->setEnabled(!backStack_.isEmpty());
  if (forwardButton_) forwardButton_->setEnabled(!forwardStack_.isEmpty());
  if (upButton_) upButton_->setEnabled(!currentPath_.isEmpty() && currentPath_ != "/");
}

void RemoteExplorerWidget::setPathText(const QString& path) {
  if (pathEdit_) pathEdit_->setText(path);
}

void RemoteExplorerWidget::populateDirectory(const QString& output) {
  if (!tree_) return;
  clearEntries();

  const auto lines = output.split('\n', Qt::SkipEmptyParts);
  QVector<Entry> directories;
  QVector<Entry> files;
  for (const auto& line : lines) {
    const auto fields = line.split('\t');
    if (fields.size() < 4) continue;
    Entry entry;
    entry.kind = fields[0];
    entry.name = fields[1];
    entry.path = fields[2];
    entry.sizeText = fields[3];
    entry.modifiedText = fields.size() > 4 ? fields[4] : QString();
    if (isDirectoryKind(entry.kind)) directories << entry;
    else files << entry;
  }

  auto compareEntry = [](const Entry& a, const Entry& b) {
    return QString::localeAwareCompare(a.name.toLower(), b.name.toLower()) < 0;
  };
  std::sort(directories.begin(), directories.end(), compareEntry);
  std::sort(files.begin(), files.end(), compareEntry);

  const auto addRows = [this](const QVector<Entry>& rows) {
    for (auto entry : rows) {
      auto* item = new QTreeWidgetItem(tree_);
      item->setText(NameColumn, entry.name);
      item->setData(NameColumn, Qt::UserRole, entry.path);
      item->setData(NameColumn, Qt::UserRole + 1, entry.kind);
      const auto sizeLabel = humanSize(entry.sizeText);
      const auto details = entry.modifiedText.isEmpty() ? QString("Size: %1").arg(sizeLabel) : QString("Size: %1\nModified: %2").arg(sizeLabel, entry.modifiedText);
      item->setToolTip(NameColumn, QString("%1\n%2").arg(entry.path, details));
      item->setIcon(NameColumn, editorIcon(isDirectoryKind(entry.kind) ? EditorIcon::Folder : EditorIcon::File, QColor("#475467"), QSize(18, 18)));
      if (isDirectoryKind(entry.kind)) {
        auto font = item->font(NameColumn);
        font.setBold(true);
        item->setFont(NameColumn, font);
      }

      entry.item = item;
      entries_ << entry;
    }
  };

  addRows(directories);
  addRows(files);
  applyFilter();
  updateNavigationButtons();
  appendStatus(QString("Loaded %1 items").arg(entries_.size()));
}

void RemoteExplorerWidget::appendStatus(const QString& message) {
  if (statusLabel_) statusLabel_->setText(message);
}

bool RemoteExplorerWidget::isDirectoryKind(const QString& kind) {
  return kind == "d";
}
