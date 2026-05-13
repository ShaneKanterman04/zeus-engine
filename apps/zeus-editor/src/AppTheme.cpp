#include "AppTheme.h"

#include <QApplication>
#include <QColor>
#include <QPalette>
#include <QStyleFactory>

void applyEditorTheme(QApplication& app) {
  if (auto* style = QStyleFactory::create("Fusion")) {
    app.setStyle(style);
  }

  QPalette palette;
  palette.setColor(QPalette::Window, QColor("#0f131a"));
  palette.setColor(QPalette::WindowText, QColor("#e5e7eb"));
  palette.setColor(QPalette::Base, QColor("#11161d"));
  palette.setColor(QPalette::AlternateBase, QColor("#171d26"));
  palette.setColor(QPalette::ToolTipBase, QColor("#11161d"));
  palette.setColor(QPalette::ToolTipText, QColor("#e5e7eb"));
  palette.setColor(QPalette::Text, QColor("#e5e7eb"));
  palette.setColor(QPalette::Button, QColor("#171d26"));
  palette.setColor(QPalette::ButtonText, QColor("#e5e7eb"));
  palette.setColor(QPalette::BrightText, QColor("#ffffff"));
  palette.setColor(QPalette::Highlight, QColor("#246d66"));
  palette.setColor(QPalette::HighlightedText, QColor("#f8fafc"));
  palette.setColor(QPalette::Link, QColor("#5fd7c7"));
  palette.setColor(QPalette::LinkVisited, QColor("#5fd7c7"));
  palette.setColor(QPalette::Disabled, QPalette::WindowText, QColor("#6b7280"));
  palette.setColor(QPalette::Disabled, QPalette::Text, QColor("#6b7280"));
  palette.setColor(QPalette::Disabled, QPalette::ButtonText, QColor("#6b7280"));
  palette.setColor(QPalette::Disabled, QPalette::Base, QColor("#0f131a"));
  palette.setColor(QPalette::Disabled, QPalette::Button, QColor("#151b23"));
  app.setPalette(palette);

  app.setStyleSheet(R"(
    QWidget {
      color: #e5e7eb;
      font-size: 13px;
    }

    QMainWindow, QDialog {
      background: #0f131a;
    }

    QStatusBar {
      background: #0d1117;
      border-top: 1px solid #253041;
      color: #9ca3af;
    }

    QTabWidget::pane {
      background: #11161d;
      border: 1px solid #263042;
      border-radius: 12px;
      top: -1px;
    }

    QTabBar::tab {
      background: #131923;
      color: #9ca3af;
      border: 1px solid #263042;
      border-bottom: none;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      padding: 8px 14px;
      margin-right: 4px;
      min-width: 96px;
    }

    QTabBar::tab:selected {
      background: #11161d;
      color: #e5e7eb;
      border-color: #334155;
    }

    QTabBar::tab:hover {
      background: #18202b;
      color: #f8fafc;
    }

    QToolBar {
      background: #0f131a;
      border: none;
      spacing: 8px;
      padding: 8px;
    }

    QToolButton, QPushButton {
      background: #171d26;
      border: 1px solid #263042;
      border-radius: 8px;
      padding: 7px 10px;
      min-height: 30px;
    }

    QToolButton:hover, QPushButton:hover {
      background: #1d2530;
      border-color: #314052;
    }

    QToolButton:pressed, QPushButton:pressed, QToolButton:checked {
      background: #16312f;
      border-color: #2d7d73;
    }

    QToolButton:disabled, QPushButton:disabled {
      background: #131923;
      border-color: #212b39;
      color: #6b7280;
    }

    QToolButton {
      padding-left: 10px;
      padding-right: 10px;
    }

    QLineEdit, QTextEdit, QPlainTextEdit, QTreeWidget, QListWidget, QScrollArea {
      background: #11161d;
      border: 1px solid #263042;
      border-radius: 10px;
      selection-background-color: #246d66;
      selection-color: #f8fafc;
    }

    QLineEdit, QTextEdit, QPlainTextEdit {
      padding: 7px 10px;
    }

    QTreeWidget, QListWidget {
      outline: 0;
    }

    QTreeWidget::item, QListWidget::item {
      padding: 6px 8px;
      border-radius: 8px;
    }

    QTreeWidget::item:hover, QListWidget::item:hover {
      background: #18202b;
    }

    QTreeWidget::item:selected, QListWidget::item:selected {
      background: #246d66;
      color: #f8fafc;
    }

    QSplitter::handle {
      background: #263042;
    }

    QSplitter::handle:horizontal {
      width: 1px;
    }

    QSplitter::handle:vertical {
      height: 1px;
    }

    QLabel#appTitle {
      font-size: 18px;
      font-weight: 600;
      color: #f8fafc;
    }

    QLabel#appSubtitle, QLabel#sectionLabel {
      color: #9ca3af;
    }

    QLabel#panelHeading {
      font-size: 14px;
      font-weight: 600;
      color: #f8fafc;
    }

    QLabel#assetPreview {
      background: #11161d;
      color: #9ca3af;
      border-radius: 10px;
    }

    QWidget#editorHeader {
      background: #11161d;
      border: 1px solid #263042;
      border-radius: 14px;
      padding: 12px;
    }

    QWidget#editorHeader QLabel {
      background: transparent;
      border: none;
    }

    QFrame#sectionRule {
      background: #263042;
      max-height: 1px;
    }

    QWebEngineView {
      background: #11161d;
      border: 1px solid #263042;
      border-radius: 10px;
    }
  )");
}
