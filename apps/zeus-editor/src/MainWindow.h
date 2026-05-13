#pragma once

#include "Profile.h"
#include "SshRunner.h"
#include "AssetBrowserWidget.h"
#include "JobPanelWidget.h"
#include "RemoteExplorerWidget.h"
#include "TerminalWidget.h"

#include <QByteArray>
#include <QHash>
#include <QMainWindow>
#include <QProcess>
#include <QTreeWidgetItem>

class QLabel;
class QLineEdit;
class QPlainTextEdit;
class QShortcut;
class QTabWidget;
class QTextEdit;
class QTreeWidget;
class QWebEngineView;
class QSplitter;
class QToolButton;

class MainWindow : public QMainWindow {
  Q_OBJECT

 public:
  explicit MainWindow(QWidget* parent = nullptr);
  explicit MainWindow(const QString& profileId, const QString& remoteTarget, const QString& remotePath, QWidget* parent = nullptr);
  ~MainWindow() override;

 private slots:
  void launchProject();
  void stopProject();
  void killStaleServer();
  void restartTerminal();
  void reloadViewport();
  void toggleTerminalFullscreen();
  void toggleViewportFullscreen();
  void restoreDefaultView();
  void updateEditor();
  void refreshFiles();
  void loadDirectory(QTreeWidgetItem* item);
  void previewFile(QTreeWidgetItem* item, int column);
  void previewPath(const QString& path);
  void syncProjectPath();

 private:
  void buildUi();
  void buildMenus();
  void loadProfile(const QString& profileId = QString());
  void applyCommandLineOverrides(const QString& remoteTarget, const QString& remotePath);
  void appendLog(const QString& message);
  void setStatus(const QString& message);
  void populateDirectory(QTreeWidgetItem* parent, const QString& output);
  void addDirectoryPlaceholder(QTreeWidgetItem* item);
  void openTunnelAndViewport();
  void cleanupProcess(QProcess*& process);
  QString engineRemotePath() const;
  QString selectedPath() const;
  int remotePort() const;
  int localPort() const;
  void setWorkspaceMode(int mode);

  EditorProfile profile_;
  SshRunner ssh_;
  QProcess* devProcess_ = nullptr;
  QProcess* tunnelProcess_ = nullptr;
  QProcess* listProcess_ = nullptr;
  QProcess* previewProcess_ = nullptr;
  QProcess* updateProcess_ = nullptr;
  QProcess* killProcess_ = nullptr;
  QByteArray previewBuffer_;

  QLineEdit* remotePathEdit_ = nullptr;
  QLabel* statusLabel_ = nullptr;
  QToolButton* launchButton_ = nullptr;
  QToolButton* stopButton_ = nullptr;
  QToolButton* killButton_ = nullptr;
  QToolButton* updateButton_ = nullptr;
  QToolButton* refreshButton_ = nullptr;
  QToolButton* reloadButton_ = nullptr;
  QToolButton* restartTerminalButton_ = nullptr;
  QShortcut* terminalShortcut_ = nullptr;
  QShortcut* viewportShortcut_ = nullptr;
  QShortcut* defaultViewShortcut_ = nullptr;
  QTreeWidget* fileTree_ = nullptr;
  RemoteExplorerWidget* explorer_ = nullptr;
  QWebEngineView* viewport_ = nullptr;
  QTabWidget* rightTabs_ = nullptr;
  QTabWidget* bottomTabs_ = nullptr;
  QSplitter* rootSplitter_ = nullptr;
  QWidget* terminalPane_ = nullptr;
  QWidget* viewportPane_ = nullptr;
  QWidget* defaultPane_ = nullptr;
  QWidget* header_ = nullptr;
  QLabel* titleLabel_ = nullptr;
  QLabel* subtitleLabel_ = nullptr;
  QLabel* pathLabel_ = nullptr;
  AssetBrowserWidget* assetBrowser_ = nullptr;
  QTextEdit* textPreview_ = nullptr;
  QLabel* imagePreview_ = nullptr;
  QPlainTextEdit* log_ = nullptr;
  TerminalWidget* terminal_ = nullptr;
  JobPanelWidget* jobs_ = nullptr;

  int workspaceMode_ = 0;
};
