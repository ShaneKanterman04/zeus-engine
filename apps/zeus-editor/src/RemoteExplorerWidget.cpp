#include "RemoteExplorerWidget.h"

#include <QAbstractItemView>
#include <QFileInfo>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QPushButton>
#include <QTableWidget>
#include <QTableWidgetItem>
#include <QToolButton>
#include <QVBoxLayout>
#include <algorithm>

namespace {

enum Columns { NameColumn = 0, KindColumn = 1, SizeColumn = 2, ModifiedColumn = 3 };

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
  if (table_) table_->setFocus();
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

void RemoteExplorerWidget::handleTableItemActivated(QTableWidgetItem* item) {
  if (!item) return;
  const auto path = item->data(Qt::UserRole).toString();
  const auto kind = item->data(Qt::UserRole + 1).toString();
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
  auto* root = new QVBoxLayout(this);
  root->setContentsMargins(0, 0, 0, 0);
  root->setSpacing(6);

  auto* navRow = new QHBoxLayout();
  navRow->setContentsMargins(0, 0, 0, 0);
  navRow->setSpacing(6);

  backButton_ = new QToolButton(this);
  backButton_->setText("<");
  forwardButton_ = new QToolButton(this);
  forwardButton_->setText(">");
  upButton_ = new QToolButton(this);
  upButton_->setText("^");
  refreshButton_ = new QPushButton("Refresh", this);
  pathEdit_ = new QLineEdit(this);
  pathEdit_->setClearButtonEnabled(true);
  searchEdit_ = new QLineEdit(this);
  searchEdit_->setPlaceholderText("Search");
  statusLabel_ = new QLabel(this);
  statusLabel_->setMinimumWidth(220);

  navRow->addWidget(backButton_);
  navRow->addWidget(forwardButton_);
  navRow->addWidget(upButton_);
  navRow->addWidget(refreshButton_);
  navRow->addWidget(pathEdit_, 1);
  navRow->addWidget(searchEdit_);
  navRow->addWidget(statusLabel_);

  table_ = new QTableWidget(this);
  table_->setColumnCount(4);
  table_->setHorizontalHeaderLabels({"Name", "Type", "Size", "Modified"});
  table_->horizontalHeader()->setStretchLastSection(true);
  table_->horizontalHeader()->setSectionResizeMode(NameColumn, QHeaderView::Stretch);
  table_->setSelectionBehavior(QAbstractItemView::SelectRows);
  table_->setSelectionMode(QAbstractItemView::SingleSelection);
  table_->setEditTriggers(QAbstractItemView::NoEditTriggers);
  table_->setSortingEnabled(false);

  root->addLayout(navRow);
  root->addWidget(table_, 1);

  connect(backButton_, &QToolButton::clicked, this, &RemoteExplorerWidget::handleBackClicked);
  connect(forwardButton_, &QToolButton::clicked, this, &RemoteExplorerWidget::handleForwardClicked);
  connect(upButton_, &QToolButton::clicked, this, &RemoteExplorerWidget::handleUpClicked);
  connect(refreshButton_, &QPushButton::clicked, this, &RemoteExplorerWidget::handleRefreshClicked);
  connect(pathEdit_, &QLineEdit::returnPressed, this, &RemoteExplorerWidget::handlePathEdited);
  connect(searchEdit_, &QLineEdit::textChanged, this, &RemoteExplorerWidget::handleSearchChanged);
  connect(table_, &QTableWidget::itemActivated, this, &RemoteExplorerWidget::handleTableItemActivated);

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
  if (!table_) return;
  table_->clearContents();
  table_->setRowCount(0);
  entries_.clear();
}

void RemoteExplorerWidget::clearProcesses() {
  stopProcess(listProcess_);
}

void RemoteExplorerWidget::applyFilter() {
  if (!table_) return;
  for (int row = 0; row < table_->rowCount(); ++row) {
    auto* nameItem = table_->item(row, NameColumn);
    const auto name = nameItem ? nameItem->text().toLower() : QString();
    const auto path = nameItem ? nameItem->data(Qt::UserRole).toString().toLower() : QString();
    const auto show = searchText_.isEmpty() || name.contains(searchText_) || path.contains(searchText_);
    table_->setRowHidden(row, !show);
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
  if (!table_) return;
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
    for (const auto& entry : rows) {
      const auto row = table_->rowCount();
      table_->insertRow(row);

      auto* nameItem = new QTableWidgetItem(entry.name);
      auto* kindItem = new QTableWidgetItem(isDirectoryKind(entry.kind) ? "dir" : "file");
      auto* sizeItem = new QTableWidgetItem(isDirectoryKind(entry.kind) ? QString() : humanSize(entry.sizeText));
      auto* modifiedItem = new QTableWidgetItem(entry.modifiedText);

      nameItem->setData(Qt::UserRole, entry.path);
      nameItem->setData(Qt::UserRole + 1, entry.kind);
      kindItem->setData(Qt::UserRole, entry.path);
      kindItem->setData(Qt::UserRole + 1, entry.kind);

      table_->setItem(row, NameColumn, nameItem);
      table_->setItem(row, KindColumn, kindItem);
      table_->setItem(row, SizeColumn, sizeItem);
      table_->setItem(row, ModifiedColumn, modifiedItem);

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

QString RemoteExplorerWidget::displayName(const QString& path) {
  return QFileInfo(path).fileName().isEmpty() ? path : QFileInfo(path).fileName();
}

bool RemoteExplorerWidget::isDirectoryKind(const QString& kind) {
  return kind == "d";
}
