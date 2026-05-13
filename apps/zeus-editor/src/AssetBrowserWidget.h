#pragma once

#include "Profile.h"
#include "SshRunner.h"

#include <QByteArray>
#include <QHash>
#include <QProcess>
#include <QStringList>
#include <QWidget>

class QLabel;
class QLineEdit;
class QListWidget;
class QListWidgetItem;
class QPlainTextEdit;
class QScrollArea;
class QTextEdit;
class QToolButton;

class AssetBrowserWidget : public QWidget {
  Q_OBJECT

 public:
  explicit AssetBrowserWidget(QWidget* parent = nullptr);
  ~AssetBrowserWidget() override;

  void setContext(const SshProfile& ssh, const QString& remoteRoot, const QStringList& ignore);
  void refresh();
  void requestFocusBrowser();

 private slots:
  void handleRefreshClicked();
  void handleSearchChanged(const QString& text);
  void handleSelectionChanged();
  void handleListReadyRead();
  void handleListFinished(int code, QProcess::ExitStatus status);
  void handleListError(QProcess::ProcessError error);
  void handleThumbnailReadyRead();
  void handleThumbnailFinished(int code, QProcess::ExitStatus status);
  void handleThumbnailError(QProcess::ProcessError error);
  void handleDetailReadyRead();
  void handleDetailFinished(int code, QProcess::ExitStatus status);
  void handleDetailError(QProcess::ProcessError error);

 private:
  struct AssetEntry {
    QString path;
    QString name;
    QString sizeText;
    QString modifiedText;
    bool isImage = false;
    QListWidgetItem* item = nullptr;
  };

  void buildUi();
  void loadAssetList();
  void startNextThumbnail();
  void loadSelectedAsset();
  void clearProcesses();
  void clearGrid();
  void applyFilter();
  void appendStatus(const QString& message);
  void showPreviewPlaceholder(const QString& text);
  QString assetListCommand() const;
  void updateItemThumbnail(const QString& path, const QByteArray& data);
  const AssetEntry* entryForPath(const QString& path) const;

  SshRunner ssh_;
  SshProfile sshProfile_;
  QString remoteRoot_;
  QStringList ignore_;
  QString searchText_;
  QStringList thumbnailQueue_;
  QByteArray listBuffer_;
  QByteArray detailBuffer_;
  QByteArray thumbnailBuffer_;
  QHash<QString, AssetEntry> entries_;
  QProcess* listProcess_ = nullptr;
  QProcess* thumbnailProcess_ = nullptr;
  QProcess* detailProcess_ = nullptr;
  QString thumbnailPath_;
  QString detailPath_;
  bool loadingList_ = false;
  bool loadingThumbnails_ = false;
  bool loadingDetail_ = false;

  QLineEdit* searchEdit_ = nullptr;
  QToolButton* refreshButton_ = nullptr;
  QLabel* statusLabel_ = nullptr;
  QListWidget* grid_ = nullptr;
  QLabel* previewImage_ = nullptr;
  QLabel* previewTitle_ = nullptr;
  QTextEdit* metadataText_ = nullptr;
  QScrollArea* previewScroll_ = nullptr;
};
