#pragma once

#include "Profile.h"
#include "SshRunner.h"

#include <QByteArray>
#include <QProcess>
#include <QWidget>
#include <QVector>

class QLineEdit;
class QLabel;
class QPushButton;
class QTableWidget;
class QTableWidgetItem;
class QToolButton;

class RemoteExplorerWidget : public QWidget {
  Q_OBJECT

 public:
  explicit RemoteExplorerWidget(QWidget* parent = nullptr);
  ~RemoteExplorerWidget() override;

  void setContext(const SshProfile& ssh, const QString& remoteRoot, const QStringList& ignore);
  void refresh();
  QString currentPath() const;
  void requestFocusExplorer();

 signals:
  void fileActivated(const QString& path);
  void directoryChanged(const QString& path);
  void statusMessage(const QString& message);

 private slots:
  void handleRefreshClicked();
  void handleUpClicked();
  void handleBackClicked();
  void handleForwardClicked();
  void handlePathEdited();
  void handleSearchChanged(const QString& text);
  void handleTableItemActivated(QTableWidgetItem* item);
  void handleListReadyRead();
  void handleListFinished(int code, QProcess::ExitStatus status);
  void handleListError(QProcess::ProcessError error);

 private:
  struct Entry {
    QString kind;
    QString name;
    QString path;
    QString sizeText;
    QString modifiedText;
    QTableWidgetItem* nameItem = nullptr;
    QTableWidgetItem* kindItem = nullptr;
    QTableWidgetItem* sizeItem = nullptr;
    QTableWidgetItem* modifiedItem = nullptr;
  };

  void buildUi();
  void loadDirectory(const QString& path, bool pushHistory = true);
  void clearEntries();
  void clearProcesses();
  void applyFilter();
  void updateNavigationButtons();
  void setPathText(const QString& path);
  void populateDirectory(const QString& output);
  void appendStatus(const QString& message);
  static QString displayName(const QString& path);
  static bool isDirectoryKind(const QString& kind);

  SshRunner ssh_;
  SshProfile sshProfile_;
  QString remoteRoot_;
  QStringList ignore_;
  QString currentPath_;
  QStringList backStack_;
  QStringList forwardStack_;
  QString searchText_;
  QByteArray listBuffer_;
  QProcess* listProcess_ = nullptr;

  QLineEdit* pathEdit_ = nullptr;
  QLineEdit* searchEdit_ = nullptr;
  QLabel* statusLabel_ = nullptr;
  QToolButton* backButton_ = nullptr;
  QToolButton* forwardButton_ = nullptr;
  QToolButton* upButton_ = nullptr;
  QPushButton* refreshButton_ = nullptr;
  QTableWidget* table_ = nullptr;
  QVector<Entry> entries_;
};
