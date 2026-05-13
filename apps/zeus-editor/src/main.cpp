#include "AppTheme.h"
#include "MainWindow.h"

#include <QApplication>
#include <QCommandLineOption>
#include <QCommandLineParser>

int main(int argc, char* argv[]) {
  QApplication app(argc, argv);
  QApplication::setApplicationName("Zeus Editor");
  QApplication::setOrganizationName("Zeus");
  applyEditorTheme(app);

  QCommandLineParser parser;
  parser.setApplicationDescription("Native Zeus visual editor");
  parser.addHelpOption();
  parser.addOption(QCommandLineOption("profile", "Profile id to load.", "id"));
  parser.addOption(QCommandLineOption("remote", "SSH target, for example shane@10.0.0.194.", "target"));
  parser.addOption(QCommandLineOption("path", "Remote project path.", "path"));
  parser.process(app);

  MainWindow window(parser.value("profile"), parser.value("remote"), parser.value("path"));
  window.show();
  return app.exec();
}
