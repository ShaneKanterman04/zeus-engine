#pragma once

#include "Profile.h"
#include "SshRunner.h"

#include <QByteArray>
#include <QHash>
#include <QProcess>
#include <QStringList>
#include <QWidget>

class QComboBox;
class QLabel;
class QLineEdit;
class QListWidget;
class QListWidgetItem;
class QPlainTextEdit;
class QPushButton;
class QTextEdit;

class AssetStudioWidget : public QWidget {
  Q_OBJECT

 public:
  explicit AssetStudioWidget(QWidget* parent = nullptr);
  ~AssetStudioWidget() override;

  void setContext(const SshProfile& ssh, const QString& remoteRoot);
  void focusPrompt();

 signals:
  void statusMessage(const QString& message);
  void assetsChanged();

 private slots:
  void generateConcepts();
  void refineSelected();
  void promoteSelected();
  void runPackAndValidate();
  void cancelJob();
  void handleSelectionChanged();

 private:
  enum class JobKind { None, Concepts, Refine, Promote, PackValidate, List, Thumbnail };

  struct RemoteImage {
    QString path;
    QListWidgetItem* item = nullptr;
  };

  void buildUi();
  bool useLocalExecution() const;
  QProcess* startCommand(const QString& command);
  void startRemoteCommand(JobKind kind, const QString& label, const QString& command);
  void finishJob(int code, QProcess::ExitStatus status);
  void appendLog(const QString& text);
  void setBusy(bool busy, const QString& label = QString());
  void refreshRunImages();
  void loadNextThumbnail();
  void loadLocalThumbnail(const QString& path);
  void clearImages();
  QString slug() const;
  QString nextRunPath() const;
  QString selectedImagePath() const;
  QString codexConceptPrompt(const QString& runPath) const;
  QString codexRefinePrompt(const QString& runPath, const QString& selectedPath) const;
  QString packCommand() const;
  QString promotedRelativePath() const;

  SshRunner ssh_;
  SshProfile sshProfile_;
  QString remoteRoot_;
  QString currentRunPath_;
  QString refinedPath_;
  QProcess* process_ = nullptr;
  QProcess* thumbnailProcess_ = nullptr;
  JobKind jobKind_ = JobKind::None;
  QByteArray listBuffer_;
  QByteArray thumbnailBuffer_;
  QString thumbnailPath_;
  QStringList thumbnailQueue_;
  QHash<QString, RemoteImage> images_;

  QLineEdit* slugEdit_ = nullptr;
  QComboBox* domainCombo_ = nullptr;
  QComboBox* packCombo_ = nullptr;
  QLineEdit* promotePathEdit_ = nullptr;
  QTextEdit* promptEdit_ = nullptr;
  QPushButton* generateButton_ = nullptr;
  QPushButton* refineButton_ = nullptr;
  QPushButton* promoteButton_ = nullptr;
  QPushButton* packButton_ = nullptr;
  QPushButton* cancelButton_ = nullptr;
  QLabel* phaseLabel_ = nullptr;
  QLabel* selectedLabel_ = nullptr;
  QListWidget* imageList_ = nullptr;
  QPlainTextEdit* log_ = nullptr;
};
