#include "MainWindow.h"

#include <QAction>
#include <QApplication>
#include <QCoreApplication>
#include <QDateTime>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QHeaderView>
#include <QImage>
#include <QLabel>
#include <QLineEdit>
#include <QMimeDatabase>
#include <QPixmap>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QRegularExpression>
#include <QSplitter>
#include <QStandardPaths>
#include <QStatusBar>
#include <QTabWidget>
#include <QTextEdit>
#include <QToolBar>
#include <QTreeWidget>
#include <QTimer>
#include <QUrl>
#include <QVBoxLayout>
#include <QWebEngineView>
#include <QWidget>

namespace {

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

  auto* toolbar = addToolBar("Project");
  toolbar->setMovable(false);

  remotePathEdit_ = new QLineEdit(profile_.project.remotePath, this);
  remotePathEdit_->setMinimumWidth(420);
  toolbar->addWidget(new QLabel("Remote project ", this));
  toolbar->addWidget(remotePathEdit_);

  auto* refreshAction = toolbar->addAction("Refresh");
  connect(refreshAction, &QAction::triggered, this, &MainWindow::refreshFiles);

  launchButton_ = new QPushButton("Launch", this);
  stopButton_ = new QPushButton("Stop", this);
  stopButton_->setEnabled(false);
  toolbar->addWidget(launchButton_);
  toolbar->addWidget(stopButton_);
  connect(launchButton_, &QPushButton::clicked, this, &MainWindow::launchProject);
  connect(stopButton_, &QPushButton::clicked, this, &MainWindow::stopProject);

  killButton_ = new QPushButton("Kill Stale Server", this);
  toolbar->addWidget(killButton_);
  connect(killButton_, &QPushButton::clicked, this, &MainWindow::killStaleServer);

  auto* terminalAction = toolbar->addAction("Restart Terminal");
  connect(terminalAction, &QAction::triggered, this, &MainWindow::restartTerminal);

  auto* strongTerminalAction = toolbar->addAction("Open Strong Terminal");
  connect(strongTerminalAction, &QAction::triggered, this, &MainWindow::openStrongTerminal);

  updateButton_ = new QPushButton("Update Editor", this);
  toolbar->addWidget(updateButton_);
  connect(updateButton_, &QPushButton::clicked, this, &MainWindow::updateEditor);

  auto* reloadAction = toolbar->addAction("Reload Viewport");
  connect(reloadAction, &QAction::triggered, this, &MainWindow::reloadViewport);

  auto* rootSplitter = new QSplitter(Qt::Horizontal, this);
  fileTree_ = new QTreeWidget(rootSplitter);
  fileTree_->setHeaderLabels({"Name", "Kind", "Size"});
  fileTree_->header()->setStretchLastSection(false);
  fileTree_->header()->setSectionResizeMode(NameColumn, QHeaderView::Stretch);
  fileTree_->setUniformRowHeights(true);
  connect(fileTree_, &QTreeWidget::itemExpanded, this, &MainWindow::loadDirectory);
  connect(fileTree_, &QTreeWidget::itemActivated, this, &MainWindow::previewFile);

  rightTabs_ = new QTabWidget(rootSplitter);
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

  rootSplitter->setStretchFactor(0, 1);
  rootSplitter->setStretchFactor(1, 3);

  auto* bottomTabs = new QTabWidget(this);
  terminal_ = new TerminalWidget(bottomTabs);
  log_ = new QPlainTextEdit(bottomTabs);
  log_->setReadOnly(true);
  log_->setMaximumBlockCount(2000);
  bottomTabs->addTab(terminal_, "Terminal");
  bottomTabs->addTab(log_, "Logs");
  bottomTabs->setMaximumHeight(240);

  auto* central = new QWidget(this);
  auto* layout = new QVBoxLayout(central);
  layout->setContentsMargins(6, 6, 6, 6);
  layout->addWidget(rootSplitter, 1);
  layout->addWidget(bottomTabs);
  setCentralWidget(central);

  statusLabel_ = new QLabel(this);
  statusBar()->addPermanentWidget(statusLabel_, 1);
  setStatus(QString("Profile %1: %2").arg(profile_.name, sshTarget(profile_.ssh)));
  restartTerminal();
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

void MainWindow::launchProject() {
  profile_.project.remotePath = remotePathEdit_->text().trimmed();
  cleanupProcess(devProcess_);
  cleanupProcess(tunnelProcess_);

  appendLog(QString("Launching %1 on %2").arg(profile_.project.dev.program, sshTarget(profile_.ssh)));
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
  profile_.project.remotePath = remotePathEdit_->text().trimmed();
  if (terminal_) terminal_->start(profile_.ssh, profile_.project.remotePath);
}

void MainWindow::openStrongTerminal() {
  profile_.project.remotePath = remotePathEdit_->text().trimmed();
  const auto remoteCommand = QString("cd %1 && exec ${SHELL:-/bin/sh} -i").arg(shellQuote(profile_.project.remotePath));
  const auto sshCommand = QString("ssh %1 -tt %2").arg(shellQuote(sshTarget(profile_.ssh)), shellQuote(remoteCommand));
  const QList<QPair<QString, QStringList>> launchers = {
      {"gnome-terminal", {"--", "sh", "-lc", sshCommand}},
      {"konsole", {"-e", "sh", "-lc", sshCommand}},
      {"xfce4-terminal", {"-e", "sh", "-lc", sshCommand}},
      {"xterm", {"-e", "sh", "-lc", sshCommand}},
      {"kitty", {"sh", "-lc", sshCommand}},
  };
  for (const auto& launcher : launchers) {
    if (QStandardPaths::findExecutable(launcher.first).isEmpty()) continue;
    if (QProcess::startDetached(launcher.first, launcher.second)) {
      appendLog(QString("Opened strong terminal with %1").arg(launcher.first));
      setStatus(QString("Strong terminal opened via %1").arg(launcher.first));
      return;
    }
  }
  appendLog("No supported terminal emulator found on this machine.");
  setStatus("No external terminal emulator found");
}

void MainWindow::reloadViewport() {
  viewport_->reload();
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
  profile_.project.remotePath = remotePathEdit_->text().trimmed();
  cleanupProcess(listProcess_);
  fileTree_->clear();
  auto* root = new QTreeWidgetItem(fileTree_, {profile_.project.remotePath, "dir", ""});
  root->setData(NameColumn, Qt::UserRole, profile_.project.remotePath);
  root->setData(NameColumn, Qt::UserRole + 1, "d");
  addDirectoryPlaceholder(root);
  root->setExpanded(true);
  loadDirectory(root);
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
  const auto path = itemPath(item);
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
