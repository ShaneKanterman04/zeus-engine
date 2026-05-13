#pragma once

#include "Profile.h"
#include "SshRunner.h"

#include <QByteArray>
#include <QHash>
#include <QMainWindow>
#include <QProcess>
#include <QTreeWidgetItem>

class QLabel;
class QLineEdit;
class QPlainTextEdit;
class QPushButton;
class QTabWidget;
class QTextEdit;
class QTreeWidget;
class QWebEngineView;

class MainWindow : public QMainWindow {
  Q_OBJECT

 public:
  explicit MainWindow(QWidget* parent = nullptr);
  explicit MainWindow(const QString& profileId, const QString& remoteTarget, const QString& remotePath, QWidget* parent = nullptr);
  ~MainWindow() override;

 private slots:
  void launchProject();
  void stopProject();
  void reloadViewport();
  void updateEditor();
  void refreshFiles();
  void loadDirectory(QTreeWidgetItem* item);
  void previewFile(QTreeWidgetItem* item, int column);

 private:
  void buildUi();
  void loadProfile(const QString& profileId = QString());
  void applyCommandLineOverrides(const QString& remoteTarget, const QString& remotePath);
  void appendLog(const QString& message);
  void setStatus(const QString& message);
  void populateDirectory(QTreeWidgetItem* parent, const QString& output);
  void addDirectoryPlaceholder(QTreeWidgetItem* item);
  void openTunnelAndViewport();
  void cleanupProcess(QProcess*& process);
  QString selectedPath() const;
  int remotePort() const;
  int localPort() const;

  EditorProfile profile_;
  SshRunner ssh_;
  QProcess* devProcess_ = nullptr;
  QProcess* tunnelProcess_ = nullptr;
  QProcess* listProcess_ = nullptr;
  QProcess* previewProcess_ = nullptr;
  QProcess* updateProcess_ = nullptr;
  QByteArray previewBuffer_;

  QLineEdit* remotePathEdit_ = nullptr;
  QLabel* statusLabel_ = nullptr;
  QPushButton* launchButton_ = nullptr;
  QPushButton* stopButton_ = nullptr;
  QPushButton* updateButton_ = nullptr;
  QTreeWidget* fileTree_ = nullptr;
  QWebEngineView* viewport_ = nullptr;
  QTabWidget* rightTabs_ = nullptr;
  QTextEdit* textPreview_ = nullptr;
  QLabel* imagePreview_ = nullptr;
  QPlainTextEdit* log_ = nullptr;
};
