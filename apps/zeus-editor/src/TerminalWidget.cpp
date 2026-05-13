#include "TerminalWidget.h"

#include <QDir>
#include <QVBoxLayout>
#include <QWebEnginePage>
#include <QWebEngineSettings>
#include <QWebEngineView>
#include <QWebChannel>

namespace {

QString terminalHtml() {
  return R"HTML(
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="__XTERM_CSS__">
  <style>
    html, body { width: 100%; height: 100%; margin: 0; background: #0f1115; overflow: hidden; }
    #terminal { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="__XTERM_JS__"></script>
  <script src="__XTERM_FIT_JS__"></script>
  <script src="qrc:///qtwebchannel/qwebchannel.js"></script>
  <script>
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#0f1115',
        foreground: '#e5e7eb',
        cursor: '#e5e7eb'
      }
    });
    const fit = new FitAddon.FitAddon();
    terminal.loadAddon(fit);
    terminal.open(document.getElementById('terminal'));
    new QWebChannel(qt.webChannelTransport, function(channel) {
      const bridge = channel.objects.bridge;
      bridge.outputReceived.connect(function(text) {
        terminal.write(text);
      });
      bridge.exited.connect(function(code) {
        terminal.writeln('');
        terminal.writeln('Terminal exited: ' + code);
      });
      terminal.onData(function(data) {
        bridge.sendInput(data);
      });
      window.addEventListener('resize', function() {
        fit.fit();
        bridge.resizeTerminal(terminal.cols, terminal.rows);
      });
      bridge.markReady();
      fit.fit();
      bridge.resizeTerminal(terminal.cols, terminal.rows);
      terminal.focus();
    });
  </script>
</body>
</html>
)HTML";
}

QString localAssetUrl(const QString& relativePath) {
  const auto root = QDir(QString::fromUtf8(ZEUS_EDITOR_SOURCE_ROOT));
  return QUrl::fromLocalFile(root.filePath(relativePath)).toString();
}

}  // namespace

TerminalWidget::TerminalWidget(QWidget* parent) : QWidget(parent) {
  buildUi();
}

TerminalWidget::~TerminalWidget() {
  stop();
}

void TerminalWidget::start(const SshProfile& ssh, const QString& remotePath) {
  stop();
  ssh_ = ssh;
  remotePath_ = remotePath;
  sessionQueued_ = true;
  pendingOutput_.clear();
  pageReady_ = false;
  loadTerminalPage();
}

void TerminalWidget::requestFocusTerminal() {
  if (view_) view_->setFocus();
}

void TerminalWidget::handleTerminalReady() {
  pageReady_ = true;
  flushPendingOutput();
  if (!sessionQueued_) return;
  sessionQueued_ = false;
  session_ = new TerminalSession(this);
  connect(session_, &TerminalSession::outputReceived, this, &TerminalWidget::handleTerminalOutput);
  connect(session_, &TerminalSession::exited, this, &TerminalWidget::handleTerminalExit);
  connect(bridge_, &TerminalBridge::inputRequested, session_, [this](const QString& text) { session_->writeInput(text); });
  connect(bridge_, &TerminalBridge::resizeRequested, session_, &TerminalSession::resize);
  session_->start(ssh_, remotePath_);
  bridge_->resizeTerminal(120, 40);
  appendOutputChunk(QString("Connecting to %1 in %2...\r\n").arg(sshTarget(ssh_), remotePath_).toUtf8());
}

void TerminalWidget::handleTerminalOutput(const QByteArray& data) {
  appendOutputChunk(data);
}

void TerminalWidget::handleTerminalExit(int code) {
  if (bridge_) bridge_->pushExit(code);
  appendOutputChunk(QString("\r\n").toUtf8());
}

void TerminalWidget::buildUi() {
  auto* layout = new QVBoxLayout(this);
  layout->setContentsMargins(0, 0, 0, 0);
  bridge_ = new TerminalBridge(this);
  view_ = new QWebEngineView(this);
  view_->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, true);
  view_->settings()->setAttribute(QWebEngineSettings::JavascriptCanAccessClipboard, true);
  auto* channel = new QWebChannel(this);
  channel->registerObject("bridge", bridge_);
  view_->page()->setWebChannel(channel);
  layout->addWidget(view_);

  connect(bridge_, &TerminalBridge::ready, this, &TerminalWidget::handleTerminalReady);
  loadTerminalPage();
}

void TerminalWidget::loadTerminalPage() {
  if (!view_) return;
  auto html = terminalHtml();
  html.replace("__XTERM_CSS__", localAssetUrl("apps/zeus-editor/vendor/xterm/css/xterm.css"));
  html.replace("__XTERM_JS__", localAssetUrl("apps/zeus-editor/vendor/xterm/lib/xterm.js"));
  html.replace("__XTERM_FIT_JS__", localAssetUrl("apps/zeus-editor/vendor/xterm-addon-fit/lib/xterm-addon-fit.js"));
  view_->setHtml(html, QUrl("qrc:/zeus-editor/terminal"));
}

void TerminalWidget::flushPendingOutput() {
  if (pendingOutput_.isEmpty() || !pageReady_) return;
  appendOutputChunk(pendingOutput_);
  pendingOutput_.clear();
}

void TerminalWidget::appendOutputChunk(const QByteArray& data) {
  if (!pageReady_) {
    pendingOutput_.append(data);
    return;
  }
  if (bridge_) bridge_->pushOutput(QString::fromUtf8(data));
}

void TerminalWidget::stop() {
  if (session_) {
    session_->stop();
    session_->deleteLater();
    session_ = nullptr;
  }
  pendingOutput_.clear();
  pageReady_ = false;
  sessionQueued_ = false;
}
