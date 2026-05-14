#pragma once

#include "Profile.h"
#include "SshRunner.h"

#include <QByteArray>
#include <QHash>
#include <QProcess>
#include <QDateTime>
#include <QStringList>
#include <QVector>
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
  void refreshStyleProfile();
  void generateConcepts();
  void refineSelected();
  void promoteSelected();
  void runPackAndValidate();
  void cancelJob();
  void handleSelectionChanged();
  void updateGenerateState();

 private:
  enum class JobKind { None, StyleProfile, Concepts, Refine, Promote, PackValidate, List, Thumbnail };
  enum class StepState { Waiting, Running, Done, Failed, Canceled };
  enum class RunStep { Prepare, StyleProfile, Codex, Generate, Verify, Thumbnails, Review, Refine, Promote, Validate, Count };

  struct RemoteImage {
    QString path;
    QListWidgetItem* item = nullptr;
  };

  struct RunFile {
    QString name;
    QString path;
    qint64 size = 0;
  };

  void buildUi();
  bool useLocalExecution() const;
  QProcess* startCommand(const QString& command);
  void startRemoteCommand(JobKind kind, const QString& label, const QString& command);
  void finishJob(int code, QProcess::ExitStatus status);
  void appendLog(const QString& text);
  void appendProcessOutput(const QString& text);
  void setBusy(bool busy, const QString& label = QString());
  void beginRun(JobKind kind, const QString& label);
  void resetProgress();
  void updateStep(RunStep step, StepState state, const QString& detail = QString());
  void failRun(const QString& message);
  void updateElapsedStatus();
  void finishRunSummary(const QList<RunFile>& files, const QStringList& missing);
  QStringList expectedFilesFor(JobKind kind) const;
  QString stepName(RunStep step) const;
  QString statePrefix(StepState state) const;
  bool isImagePath(const QString& path) const;
  bool styleProfileExists() const;
  QString styleProfileDir() const;
  QString styleProfileJsonPath() const;
  QString styleProfileMarkdownPath() const;
  QString styleProfilePrompt() const;
  QString contactSheetArgs();
  QStringList contactSheetPaths() const;
  void startStyleProfileRefresh(bool continueGeneration);
  QString assetRequestText() const;
  void refreshRunImages();
  void loadNextThumbnail();
  bool loadLocalThumbnail(const QString& path);
  void handleMissingRunImages();
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
  QString activeRunPath_;
  QString refinedPath_;
  QProcess* process_ = nullptr;
  QProcess* thumbnailProcess_ = nullptr;
  QTimer* elapsedTimer_ = nullptr;
  JobKind jobKind_ = JobKind::None;
  JobKind activeRunKind_ = JobKind::None;
  bool cancelRequested_ = false;
  bool pendingConceptAfterStyleProfile_ = false;
  QDateTime runStartedAt_;
  QString activeRunLabel_;
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
  QPushButton* styleProfileButton_ = nullptr;
  QPushButton* refineButton_ = nullptr;
  QPushButton* promoteButton_ = nullptr;
  QPushButton* packButton_ = nullptr;
  QPushButton* cancelButton_ = nullptr;
  QLabel* phaseLabel_ = nullptr;
  QLabel* selectedLabel_ = nullptr;
  QLabel* summaryLabel_ = nullptr;
  QListWidget* progressList_ = nullptr;
  QListWidget* imageList_ = nullptr;
  QPlainTextEdit* log_ = nullptr;
  QVector<QListWidgetItem*> progressItems_;
};
