#include "MainWindow.h"

#include "EditorIcons.h"

#include <QAction>
#include <QApplication>
#include <QCoreApplication>
#include <QDateTime>
#include <QFileInfo>
#include <QFrame>
#include <QJsonArray>
#include <QJsonDocument>
#include <QDir>
#include <QHeaderView>
#include <QImage>
#include <QHBoxLayout>
#include <QFont>
#include <QLabel>
#include <QLineEdit>
#include <QMenu>
#include <QMenuBar>
#include <QMimeDatabase>
#include <QPixmap>
#include <QPlainTextEdit>
#include <QKeySequence>
#include <QRegularExpression>
#include <QShortcut>
#include <QSize>
#include <QSplitter>
#include <QStandardPaths>
#include <QStatusBar>
#include <QTabWidget>
#include <QTextEdit>
#include <QToolButton>
#include <QTreeWidget>
#include <QTimer>
#include <QUrl>
#include <QVBoxLayout>
#include <QWebEngineView>
#include <QWidget>

namespace {

enum WorkspaceMode {
  WorkspaceDefault = 0,
  WorkspaceTerminalFullscreen = 1,
  WorkspaceViewportFullscreen = 2,
};

enum FileColumns { NameColumn = 0, KindColumn = 1, SizeColumn = 2 };

QString itemPath(QTreeWidgetItem* item) {
  return item ? item->data(NameColumn, Qt::UserRole).toString() : QString();
}

bool isDirectoryItem(QTreeWidgetItem* item) {
  return item && item->data(NameColumn, Qt::UserRole + 1).toString() == "d";
}

bool isPlaceholder(QTreeWidgetItem* item) {
  return item && item->data(NameColumn, Qt::UserRole + 2).toBool();
}

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

int portFromUrl(const QString& url, int fallback) {
  const QUrl parsed(url);
  return parsed.port(fallback);
}

QToolButton* createIconButton(QWidget* parent, EditorIcon icon, const QString& tooltip) {
  auto* button = new QToolButton(parent);
  button->setAutoRaise(true);
  button->setToolButtonStyle(Qt::ToolButtonIconOnly);
  button->setIcon(editorIcon(icon));
  button->setIconSize(QSize(18, 18));
  button->setFixedSize(34, 34);
  button->setToolTip(tooltip);
  return button;
}

}  // namespace

MainWindow::MainWindow(QWidget* parent) : QMainWindow(parent) {
  loadProfile();
  buildUi();
  refreshFiles();
}

MainWindow::MainWindow(const QString& profileId, const QString& remoteTarget, const QString& remotePath, QWidget* parent) : QMainWindow(parent) {
  loadProfile(profileId);
  applyCommandLineOverrides(remoteTarget, remotePath);
  buildUi();
  refreshFiles();
}

MainWindow::~MainWindow() {
  cleanupProcess(previewProcess_);
  cleanupProcess(listProcess_);
  cleanupProcess(updateProcess_);
  cleanupProcess(killProcess_);
  cleanupProcess(tunnelProcess_);
  cleanupProcess(devProcess_);
}

void MainWindow::buildUi() {
  setWindowTitle("Zeus Editor");
  resize(1440, 900);

  auto* central = new QWidget(this);
  auto* layout = new QVBoxLayout(central);
  layout->setContentsMargins(12, 12, 12, 12);
  layout->setSpacing(12);

  header_ = new QWidget(central);
  header_->setObjectName("editorHeader");
  auto* headerLayout = new QHBoxLayout(header_);
  headerLayout->setContentsMargins(12, 12, 12, 12);
  headerLayout->setSpacing(12);

  auto* titleBlock = new QWidget(header_);
  auto* titleLayout = new QVBoxLayout(titleBlock);
  titleLayout->setContentsMargins(0, 0, 0, 0);
  titleLayout->setSpacing(2);
  titleLabel_ = new QLabel("Zeus Editor", titleBlock);
  titleLabel_->setObjectName("appTitle");
  subtitleLabel_ = new QLabel(QString("%1 - %2").arg(profile_.name, sshTarget(profile_.ssh)), titleBlock);
  subtitleLabel_->setObjectName("appSubtitle");
  titleLayout->addWidget(titleLabel_);
  titleLayout->addWidget(subtitleLabel_);

  auto* pathBlock = new QWidget(header_);
  auto* pathLayout = new QVBoxLayout(pathBlock);
  pathLayout->setContentsMargins(0, 0, 0, 0);
  pathLayout->setSpacing(6);
  pathLabel_ = new QLabel("Remote project", pathBlock);
  pathLabel_->setObjectName("sectionLabel");
  remotePathEdit_ = new QLineEdit(profile_.project.remotePath, pathBlock);
  remotePathEdit_->setMinimumWidth(420);
  remotePathEdit_->setPlaceholderText("/home/shane/Projects/...");
  pathLayout->addWidget(pathLabel_);
  pathLayout->addWidget(remotePathEdit_);

  auto* actions = new QWidget(header_);
  auto* actionsLayout = new QHBoxLayout(actions);
  actionsLayout->setContentsMargins(0, 0, 0, 0);
  actionsLayout->setSpacing(6);

  refreshButton_ = createIconButton(actions, EditorIcon::Refresh, "Refresh files");
  restartTerminalButton_ = createIconButton(actions, EditorIcon::Terminal, "Restart terminal");
  reloadButton_ = createIconButton(actions, EditorIcon::Viewport, "Reload viewport");
  updateButton_ = createIconButton(actions, EditorIcon::Update, "Update editor");
  killButton_ = createIconButton(actions, EditorIcon::Kill, "Kill stale server");
  launchButton_ = createIconButton(actions, EditorIcon::Play, "Launch remote dev server");
  stopButton_ = createIconButton(actions, EditorIcon::Stop, "Stop remote dev server");
  stopButton_->setEnabled(false);

  actionsLayout->addWidget(refreshButton_);
  actionsLayout->addWidget(restartTerminalButton_);
  actionsLayout->addWidget(reloadButton_);
  actionsLayout->addWidget(updateButton_);
  actionsLayout->addWidget(killButton_);
  actionsLayout->addWidget(launchButton_);
  actionsLayout->addWidget(stopButton_);

  headerLayout->addWidget(titleBlock);
  headerLayout->addWidget(pathBlock, 1);
  headerLayout->addWidget(actions);

  connect(refreshButton_, &QToolButton::clicked, this, &MainWindow::refreshFiles);
  connect(launchButton_, &QToolButton::clicked, this, &MainWindow::launchProject);
  connect(stopButton_, &QToolButton::clicked, this, &MainWindow::stopProject);
  connect(killButton_, &QToolButton::clicked, this, &MainWindow::killStaleServer);
  connect(restartTerminalButton_, &QToolButton::clicked, this, &MainWindow::restartTerminal);
  connect(updateButton_, &QToolButton::clicked, this, &MainWindow::updateEditor);
  connect(reloadButton_, &QToolButton::clicked, this, &MainWindow::reloadViewport);

  rootSplitter_ = new QSplitter(Qt::Horizontal, central);
  rootSplitter_->setObjectName("workspaceSplitter");

  explorer_ = new RemoteExplorerWidget(rootSplitter_);
  connect(explorer_, &RemoteExplorerWidget::fileActivated, this, &MainWindow::previewPath);
  connect(explorer_, &RemoteExplorerWidget::statusMessage, this, [this](const QString& message) { setStatus(message); });

  bottomTabs_ = new QTabWidget(rootSplitter_);
  bottomTabs_->setObjectName("workspaceTabs");
  bottomTabs_->setDocumentMode(true);
  bottomTabs_->setUsesScrollButtons(false);
  terminal_ = new TerminalWidget(bottomTabs_);
  jobs_ = new JobPanelWidget(bottomTabs_);
  log_ = new QPlainTextEdit(bottomTabs_);
  log_->setReadOnly(true);
  log_->setMaximumBlockCount(2000);
  bottomTabs_->addTab(terminal_, "Terminal");
  bottomTabs_->addTab(jobs_, "Jobs");
  bottomTabs_->addTab(log_, "Logs");

  rightTabs_ = new QTabWidget(rootSplitter_);
  rightTabs_->setDocumentMode(true);
  rightTabs_->setUsesScrollButtons(false);
  viewport_ = new QWebEngineView(rightTabs_);
  rightTabs_->addTab(viewport_, "Viewport");

  auto* previewHost = new QWidget(rightTabs_);
  auto* previewLayout = new QVBoxLayout(previewHost);
  textPreview_ = new QTextEdit(previewHost);
  textPreview_->setReadOnly(true);
  imagePreview_ = new QLabel(previewHost);
  imagePreview_->setAlignment(Qt::AlignCenter);
  imagePreview_->setVisible(false);
  previewLayout->addWidget(textPreview_);
  previewLayout->addWidget(imagePreview_);
  rightTabs_->addTab(previewHost, "Preview");

  assetBrowser_ = new AssetBrowserWidget(rightTabs_);
  rightTabs_->addTab(assetBrowser_, "Assets");

  rootSplitter_->setStretchFactor(0, 1);
  rootSplitter_->setStretchFactor(1, 4);
  rootSplitter_->setStretchFactor(2, 3);
  rootSplitter_->setHandleWidth(1);
  rootSplitter_->setChildrenCollapsible(false);

  layout->addWidget(header_);
  layout->addWidget(rootSplitter_, 1);
  setCentralWidget(central);
  buildMenus();

  terminalShortcut_ = new QShortcut(QKeySequence(Qt::CTRL | Qt::Key_1), this);
  terminalShortcut_->setContext(Qt::ApplicationShortcut);
  connect(terminalShortcut_, &QShortcut::activated, this, &MainWindow::toggleTerminalFullscreen);

  viewportShortcut_ = new QShortcut(QKeySequence(Qt::CTRL | Qt::Key_2), this);
  viewportShortcut_->setContext(Qt::ApplicationShortcut);
  connect(viewportShortcut_, &QShortcut::activated, this, &MainWindow::toggleViewportFullscreen);

  defaultViewShortcut_ = new QShortcut(QKeySequence(Qt::CTRL | Qt::Key_QuoteLeft), this);
  defaultViewShortcut_->setContext(Qt::ApplicationShortcut);
  connect(defaultViewShortcut_, &QShortcut::activated, this, &MainWindow::restoreDefaultView);

  statusLabel_ = new QLabel(this);
  statusBar()->addPermanentWidget(statusLabel_, 1);
  setStatus(QString("Profile %1: %2").arg(profile_.name, sshTarget(profile_.ssh)));
  if (assetBrowser_) assetBrowser_->setContext(profile_.ssh, profile_.project.remotePath, profile_.project.ignore);
  if (explorer_) explorer_->setContext(profile_.ssh, profile_.project.remotePath, profile_.project.ignore);
  if (jobs_) {
    jobs_->setContext(profile_.ssh, profile_.project.remotePath, engineRemotePath());
    connect(jobs_, &JobPanelWidget::jobStarted, this, [this](const QString& label) {
      bottomTabs_->setCurrentWidget(jobs_);
      setStatus(QString("Running %1").arg(label));
      appendLog(QString("Job started: %1").arg(label));
    });
    connect(jobs_, &JobPanelWidget::jobFinished, this, [this](const QString& label, int code) {
      setStatus(QString("%1 finished with exit code %2").arg(label).arg(code));
      appendLog(QString("Job finished: %1 code=%2").arg(label).arg(code));
    });
  }
  setWorkspaceMode(WorkspaceDefault);
  restartTerminal();
  bottomTabs_->setCurrentWidget(terminal_);
  QTimer::singleShot(100, this, [this]() {
    if (terminal_) terminal_->requestFocusTerminal();
  });
}

void MainWindow::buildMenus() {
  auto* fileMenu = menuBar()->addMenu("&File");
  auto* refreshAction = fileMenu->addAction("Refresh Files");
  refreshAction->setShortcut(QKeySequence::Refresh);
  connect(refreshAction, &QAction::triggered, this, &MainWindow::refreshFiles);

  fileMenu->addSeparator();
  auto* launchAction = fileMenu->addAction("Launch Dev Server");
  launchAction->setShortcut(QKeySequence(Qt::CTRL | Qt::Key_R));
  connect(launchAction, &QAction::triggered, this, &MainWindow::launchProject);
  auto* stopAction = fileMenu->addAction("Stop Dev Server");
  connect(stopAction, &QAction::triggered, this, &MainWindow::stopProject);
  auto* killAction = fileMenu->addAction("Kill Stale Server");
  connect(killAction, &QAction::triggered, this, &MainWindow::killStaleServer);

  fileMenu->addSeparator();
  auto* updateAction = fileMenu->addAction("Update Editor");
  connect(updateAction, &QAction::triggered, this, &MainWindow::updateEditor);
  fileMenu->addSeparator();
  auto* quitAction = fileMenu->addAction("Quit");
  quitAction->setShortcut(QKeySequence::Quit);
  connect(quitAction, &QAction::triggered, this, &QWidget::close);

  auto* editMenu = menuBar()->addMenu("&Edit");
  auto* focusPathAction = editMenu->addAction("Focus Remote Path");
  focusPathAction->setShortcut(QKeySequence(Qt::CTRL | Qt::Key_L));
  connect(focusPathAction, &QAction::triggered, this, [this]() {
    if (!remotePathEdit_) return;
    remotePathEdit_->setFocus();
    remotePathEdit_->selectAll();
  });
  auto* restartTerminalAction = editMenu->addAction("Restart Terminal");
  restartTerminalAction->setShortcut(QKeySequence(Qt::CTRL | Qt::SHIFT | Qt::Key_T));
  connect(restartTerminalAction, &QAction::triggered, this, &MainWindow::restartTerminal);
  auto* reloadViewportAction = editMenu->addAction("Reload Viewport");
  reloadViewportAction->setShortcut(QKeySequence(Qt::CTRL | Qt::SHIFT | Qt::Key_R));
  connect(reloadViewportAction, &QAction::triggered, this, &MainWindow::reloadViewport);

  auto* panelsMenu = menuBar()->addMenu("&Panels");
  auto* defaultLayoutAction = panelsMenu->addAction("Default Layout");
  defaultLayoutAction->setShortcut(QKeySequence(Qt::CTRL | Qt::Key_QuoteLeft));
  connect(defaultLayoutAction, &QAction::triggered, this, &MainWindow::restoreDefaultView);
  panelsMenu->addSeparator();

  auto* terminalAction = panelsMenu->addAction("Terminal");
  terminalAction->setShortcut(QKeySequence(Qt::CTRL | Qt::Key_1));
  connect(terminalAction, &QAction::triggered, this, [this]() {
    setWorkspaceMode(WorkspaceDefault);
    bottomTabs_->setCurrentWidget(terminal_);
    terminal_->requestFocusTerminal();
  });
  auto* jobsAction = panelsMenu->addAction("Jobs");
  connect(jobsAction, &QAction::triggered, this, [this]() {
    setWorkspaceMode(WorkspaceDefault);
    bottomTabs_->setCurrentWidget(jobs_);
    jobs_->setFocus();
  });
  auto* logsAction = panelsMenu->addAction("Logs");
  connect(logsAction, &QAction::triggered, this, [this]() {
    setWorkspaceMode(WorkspaceDefault);
    bottomTabs_->setCurrentWidget(log_);
    log_->setFocus();
  });
  panelsMenu->addSeparator();

  auto* viewportAction = panelsMenu->addAction("Viewport");
  viewportAction->setShortcut(QKeySequence(Qt::CTRL | Qt::Key_2));
  connect(viewportAction, &QAction::triggered, this, [this]() {
    setWorkspaceMode(WorkspaceDefault);
    rightTabs_->setCurrentWidget(viewport_);
    viewport_->setFocus();
  });
  auto* previewAction = panelsMenu->addAction("Preview");
  connect(previewAction, &QAction::triggered, this, [this]() {
    setWorkspaceMode(WorkspaceDefault);
    rightTabs_->setCurrentIndex(1);
    textPreview_->setFocus();
  });
  auto* assetsAction = panelsMenu->addAction("Assets");
  connect(assetsAction, &QAction::triggered, this, [this]() {
    setWorkspaceMode(WorkspaceDefault);
    rightTabs_->setCurrentWidget(assetBrowser_);
    assetBrowser_->setFocus();
  });
  panelsMenu->addSeparator();

  auto* terminalFullscreenAction = panelsMenu->addAction("Terminal Focus Mode");
  terminalFullscreenAction->setShortcut(QKeySequence(Qt::CTRL | Qt::SHIFT | Qt::Key_1));
  connect(terminalFullscreenAction, &QAction::triggered, this, &MainWindow::toggleTerminalFullscreen);
  auto* viewportFullscreenAction = panelsMenu->addAction("Viewport Focus Mode");
  viewportFullscreenAction->setShortcut(QKeySequence(Qt::CTRL | Qt::SHIFT | Qt::Key_2));
  connect(viewportFullscreenAction, &QAction::triggered, this, &MainWindow::toggleViewportFullscreen);
}

void MainWindow::loadProfile(const QString& profileId) {
  QString error;
  const auto profiles = loadProfiles(&error);
  if (!profiles.isEmpty()) {
    profile_ = profiles.first();
    for (const auto& profile : profiles) {
      if (!profileId.isEmpty() && profile.id == profileId) {
        profile_ = profile;
        break;
      }
    }
  }
  if (!error.isEmpty()) appendLog(error);
}

void MainWindow::applyCommandLineOverrides(const QString& remoteTarget, const QString& remotePath) {
  if (!remoteTarget.isEmpty()) {
    const auto at = remoteTarget.indexOf('@');
    if (at >= 0) {
      profile_.ssh.user = remoteTarget.left(at);
      profile_.ssh.host = remoteTarget.mid(at + 1);
    } else {
      profile_.ssh.host = remoteTarget;
    }
  }
  if (!remotePath.isEmpty()) profile_.project.remotePath = remotePath;
}

void MainWindow::syncProjectPath() {
  profile_.project.remotePath = remotePathEdit_ ? remotePathEdit_->text().trimmed() : profile_.project.remotePath;
  if (jobs_) jobs_->setContext(profile_.ssh, profile_.project.remotePath, engineRemotePath());
}

void MainWindow::launchProject() {
  syncProjectPath();
  cleanupProcess(devProcess_);
  cleanupProcess(tunnelProcess_);
  cleanupProcess(killProcess_);

  appendLog(QString("Launching %1 on %2").arg(profile_.project.dev.program, sshTarget(profile_.ssh)));
  appendLog("Stale ports 5173-5180 are cleaned up inside the launch command.");
  devProcess_ = ssh_.startDevServer(profile_, this);
  connect(devProcess_, &QProcess::readyRead, this, [this]() {
    const auto output = QString::fromUtf8(devProcess_->readAll());
    appendLog(output.trimmed());
    if (!tunnelProcess_ && output.contains(QRegularExpression("https?://|Local:|ready|VITE", QRegularExpression::CaseInsensitiveOption))) {
      openTunnelAndViewport();
    }
  });
  connect(devProcess_, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
    appendLog(QString("Dev process error: %1").arg(error));
  });
  connect(devProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int code, QProcess::ExitStatus status) {
    appendLog(QString("Dev process exited: code=%1 status=%2").arg(code).arg(status));
    launchButton_->setEnabled(true);
    stopButton_->setEnabled(false);
  });

  launchButton_->setEnabled(false);
  stopButton_->setEnabled(true);
  QTimer::singleShot(1500, this, [this]() {
    if (devProcess_ && !tunnelProcess_) openTunnelAndViewport();
  });
}

void MainWindow::stopProject() {
  cleanupProcess(tunnelProcess_);
  cleanupProcess(devProcess_);
  launchButton_->setEnabled(true);
  stopButton_->setEnabled(false);
  setStatus("Stopped");
}

void MainWindow::killStaleServer() {
  cleanupProcess(killProcess_);
  cleanupProcess(tunnelProcess_);
  const auto port = remotePort();
  appendLog(QString("Killing any remote process listening on port %1...").arg(port));
  killButton_->setEnabled(false);
  killProcess_ = ssh_.killRemotePort(profile_.ssh, port, this);
  connect(killProcess_, &QProcess::readyRead, this, [this]() {
    appendLog(QString::fromUtf8(killProcess_->readAll()).trimmed());
  });
  connect(killProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int code, QProcess::ExitStatus status) {
    appendLog(QString("Kill stale server finished: code=%1 status=%2").arg(code).arg(status));
    killButton_->setEnabled(true);
  });
  connect(killProcess_, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
    appendLog(QString("Kill stale server error: %1").arg(error));
    killButton_->setEnabled(true);
  });
}

void MainWindow::restartTerminal() {
  syncProjectPath();
  if (terminal_) terminal_->start(profile_.ssh, profile_.project.remotePath);
}

void MainWindow::reloadViewport() {
  viewport_->reload();
}

void MainWindow::toggleTerminalFullscreen() {
  setWorkspaceMode(workspaceMode_ == WorkspaceTerminalFullscreen ? WorkspaceDefault : WorkspaceTerminalFullscreen);
}

void MainWindow::toggleViewportFullscreen() {
  setWorkspaceMode(workspaceMode_ == WorkspaceViewportFullscreen ? WorkspaceDefault : WorkspaceViewportFullscreen);
}

void MainWindow::restoreDefaultView() {
  setWorkspaceMode(WorkspaceDefault);
}

void MainWindow::setWorkspaceMode(int mode) {
  workspaceMode_ = mode;
  if (!rootSplitter_ || !bottomTabs_) return;

  switch (workspaceMode_) {
    case WorkspaceTerminalFullscreen:
      rootSplitter_->show();
      explorer_->hide();
      rightTabs_->hide();
      bottomTabs_->show();
      bottomTabs_->setCurrentWidget(terminal_);
      terminal_->requestFocusTerminal();
      setStatus("Terminal fullscreen");
      break;
    case WorkspaceViewportFullscreen:
      rootSplitter_->show();
      explorer_->hide();
      bottomTabs_->hide();
      rightTabs_->show();
      rightTabs_->setCurrentWidget(viewport_);
      viewport_->setFocus();
      setStatus("Viewport fullscreen");
      break;
    default:
      rootSplitter_->show();
      explorer_->show();
      bottomTabs_->show();
      rightTabs_->show();
      setStatus(QString("Profile %1: %2").arg(profile_.name, sshTarget(profile_.ssh)));
      break;
  }
}

void MainWindow::updateEditor() {
  cleanupProcess(updateProcess_);
  appendLog("Updating Zeus editor from git...");
  updateButton_->setEnabled(false);

  updateProcess_ = new QProcess(this);
  updateProcess_->setWorkingDirectory(QString::fromUtf8(ZEUS_EDITOR_SOURCE_ROOT));
  updateProcess_->setProgram("node");
  const auto restartArgs = QJsonDocument(QJsonArray::fromStringList(QCoreApplication::arguments().mid(1))).toJson(QJsonDocument::Compact);
  updateProcess_->setArguments({
      "scripts/editor-cmake.mjs",
      "update",
      "--restart-exec",
      QCoreApplication::applicationFilePath(),
      "--restart-args-json",
      QString::fromUtf8(restartArgs),
  });
  updateProcess_->setProcessChannelMode(QProcess::MergedChannels);
  connect(updateProcess_, &QProcess::readyRead, this, [this]() {
    appendLog(QString::fromUtf8(updateProcess_->readAll()).trimmed());
  });
  connect(updateProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this](int code, QProcess::ExitStatus status) {
    appendLog(QString("Editor update finished: code=%1 status=%2. Restarting editor...").arg(code).arg(status));
    updateButton_->setEnabled(true);
    if (code == 0) {
      appendLog("Editor update completed. The updater script will relaunch the editor.");
      QCoreApplication::quit();
    }
  });
  connect(updateProcess_, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
    appendLog(QString("Editor update error: %1").arg(error));
    updateButton_->setEnabled(true);
  });
  updateProcess_->start();
}

void MainWindow::refreshFiles() {
  syncProjectPath();
  cleanupProcess(listProcess_);
  if (explorer_) {
    explorer_->setContext(profile_.ssh, profile_.project.remotePath, profile_.project.ignore);
    explorer_->refresh();
  }
  if (assetBrowser_) {
    assetBrowser_->setContext(profile_.ssh, profile_.project.remotePath, profile_.project.ignore);
    assetBrowser_->refresh();
  }
  if (jobs_) jobs_->setContext(profile_.ssh, profile_.project.remotePath, engineRemotePath());
}

void MainWindow::loadDirectory(QTreeWidgetItem* item) {
  if (!isDirectoryItem(item)) return;
  if (item->childCount() > 0 && !isPlaceholder(item->child(0))) return;

  cleanupProcess(listProcess_);
  const auto path = itemPath(item);
  appendLog(QString("Listing %1").arg(path));
  listProcess_ = ssh_.runRemoteCommand(profile_.ssh, ssh_.listDirectoryCommand(profile_, path), this);
  connect(listProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this, item](int, QProcess::ExitStatus) {
    const auto output = QString::fromUtf8(listProcess_->readAll());
    item->takeChildren();
    populateDirectory(item, output);
  });
}

void MainWindow::previewFile(QTreeWidgetItem* item, int) {
  if (isDirectoryItem(item)) {
    item->setExpanded(!item->isExpanded());
    return;
  }
  previewPath(itemPath(item));
}

void MainWindow::previewPath(const QString& path) {
  if (path.isEmpty()) return;

  cleanupProcess(previewProcess_);
  previewBuffer_.clear();
  textPreview_->clear();
  imagePreview_->clear();
  imagePreview_->setVisible(false);
  textPreview_->setVisible(true);
  rightTabs_->setCurrentIndex(1);
  appendLog(QString("Previewing %1").arg(path));

  previewProcess_ = ssh_.streamRemoteFile(profile_.ssh, path, this);
  connect(previewProcess_, &QProcess::readyReadStandardOutput, this, [this]() {
    previewBuffer_.append(previewProcess_->readAllStandardOutput());
    if (previewBuffer_.size() > 2 * 1024 * 1024) {
      previewProcess_->kill();
      textPreview_->setPlainText("Preview stopped: file is larger than 2 MB.");
    }
  });
  connect(previewProcess_, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this, [this, path](int, QProcess::ExitStatus) {
    QMimeDatabase db;
    const auto mime = db.mimeTypeForFile(path);
    QImage image;
    if (mime.name().startsWith("image/") && image.loadFromData(previewBuffer_)) {
      textPreview_->setVisible(false);
      imagePreview_->setVisible(true);
      imagePreview_->setPixmap(QPixmap::fromImage(image).scaled(imagePreview_->size(), Qt::KeepAspectRatio, Qt::SmoothTransformation));
      return;
    }
    textPreview_->setPlainText(QString::fromUtf8(previewBuffer_));
  });
}

void MainWindow::appendLog(const QString& message) {
  if (!log_) return;
  if (message.isEmpty()) return;
  log_->appendPlainText(QString("[%1] %2").arg(QDateTime::currentDateTime().toString("HH:mm:ss"), message));
}

void MainWindow::setStatus(const QString& message) {
  if (statusLabel_) statusLabel_->setText(message);
}

void MainWindow::populateDirectory(QTreeWidgetItem* parent, const QString& output) {
  const auto lines = output.split('\n', Qt::SkipEmptyParts);
  for (const auto& line : lines) {
    const auto fields = line.split('\t');
    if (fields.size() < 4) continue;
    const auto kind = fields[0];
    const auto name = fields[1];
    const auto path = fields[2];
    const auto size = fields[3];
    const auto label = kind == "d" ? "dir" : "file";
    auto* child = new QTreeWidgetItem(parent, {name, label, kind == "d" ? QString() : humanSize(size)});
    child->setData(NameColumn, Qt::UserRole, path);
    child->setData(NameColumn, Qt::UserRole + 1, kind);
    if (kind == "d") addDirectoryPlaceholder(child);
  }
}

void MainWindow::addDirectoryPlaceholder(QTreeWidgetItem* item) {
  auto* placeholder = new QTreeWidgetItem(item, {"Loading...", "", ""});
  placeholder->setData(NameColumn, Qt::UserRole + 2, true);
}

void MainWindow::openTunnelAndViewport() {
  cleanupProcess(tunnelProcess_);
  const auto remote = remotePort();
  const auto local = localPort();
  appendLog(QString("Opening tunnel 127.0.0.1:%1 -> 127.0.0.1:%2").arg(local).arg(remote));
  tunnelProcess_ = ssh_.startTunnel(profile_.ssh, local, remote, this);
  connect(tunnelProcess_, &QProcess::readyRead, this, [this]() {
    appendLog(QString::fromUtf8(tunnelProcess_->readAll()).trimmed());
  });
  connect(tunnelProcess_, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
    appendLog(QString("Tunnel error: %1").arg(error));
  });
  const auto url = QUrl(QString("http://127.0.0.1:%1/").arg(local));
  viewport_->load(url);
  rightTabs_->setCurrentIndex(0);
  setStatus(QString("Viewport %1").arg(url.toString()));
}

void MainWindow::cleanupProcess(QProcess*& process) {
  if (!process) return;
  process->disconnect(this);
  if (process->state() != QProcess::NotRunning) {
    process->terminate();
    if (!process->waitForFinished(1500)) process->kill();
  }
  process->deleteLater();
  process = nullptr;
}

QString MainWindow::engineRemotePath() const {
  const auto configured = profile_.project.engineRemotePath.trimmed();
  if (!configured.isEmpty()) return configured;
  QDir projectDir(profile_.project.remotePath);
  projectDir.cdUp();
  const auto sibling = projectDir.filePath("zeus-engine");
  return sibling.isEmpty() ? QString("/home/shane/Projects/zeus-engine") : sibling;
}

QString MainWindow::selectedPath() const {
  return itemPath(fileTree_->currentItem());
}

int MainWindow::remotePort() const {
  const auto fromUrl = portFromUrl(profile_.project.dev.readyUrl, 0);
  if (fromUrl > 0) return fromUrl;
  return profile_.project.forwardPorts.isEmpty() ? 5173 : profile_.project.forwardPorts.first();
}

int MainWindow::localPort() const {
  return remotePort();
}
