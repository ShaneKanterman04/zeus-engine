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
  palette.setColor(QPalette::Window, QColor("#f4f6f8"));
  palette.setColor(QPalette::WindowText, QColor("#17202a"));
  palette.setColor(QPalette::Base, QColor("#ffffff"));
  palette.setColor(QPalette::AlternateBase, QColor("#f7f9fc"));
  palette.setColor(QPalette::ToolTipBase, QColor("#17202a"));
  palette.setColor(QPalette::ToolTipText, QColor("#ffffff"));
  palette.setColor(QPalette::Text, QColor("#17202a"));
  palette.setColor(QPalette::Button, QColor("#ffffff"));
  palette.setColor(QPalette::ButtonText, QColor("#17202a"));
  palette.setColor(QPalette::BrightText, QColor("#ffffff"));
  palette.setColor(QPalette::Highlight, QColor("#0f766e"));
  palette.setColor(QPalette::HighlightedText, QColor("#ffffff"));
  palette.setColor(QPalette::Link, QColor("#2563eb"));
  palette.setColor(QPalette::LinkVisited, QColor("#2563eb"));
  palette.setColor(QPalette::Disabled, QPalette::WindowText, QColor("#98a2b3"));
  palette.setColor(QPalette::Disabled, QPalette::Text, QColor("#98a2b3"));
  palette.setColor(QPalette::Disabled, QPalette::ButtonText, QColor("#98a2b3"));
  palette.setColor(QPalette::Disabled, QPalette::Base, QColor("#f2f4f7"));
  palette.setColor(QPalette::Disabled, QPalette::Button, QColor("#f2f4f7"));
  app.setPalette(palette);

  app.setStyleSheet(R"(
    QWidget {
      color: #17202a;
      font-size: 13px;
    }

    QMainWindow, QDialog {
      background: #f4f6f8;
    }

    QStatusBar {
      background: #ffffff;
      border-top: 1px solid #d8dee7;
      color: #667085;
      padding: 2px 8px;
    }

    QTabWidget::pane {
      background: #ffffff;
      border: 1px solid #d8dee7;
      border-radius: 8px;
      top: -1px;
    }

    QTabBar::tab {
      background: transparent;
      color: #667085;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: 9px 14px 8px 14px;
      margin-right: 6px;
      min-width: 88px;
    }

    QTabBar::tab:selected {
      color: #0f766e;
      border-bottom-color: #0f766e;
    }

    QTabBar::tab:hover {
      color: #17202a;
      background: #f7f9fc;
    }

    QToolButton, QPushButton {
      background: #ffffff;
      border: 1px solid #d8dee7;
      border-radius: 7px;
      padding: 6px 9px;
      min-width: 30px;
      min-height: 30px;
    }

    QToolButton:hover, QPushButton:hover {
      background: #f7f9fc;
      border-color: #c8d1df;
    }

    QToolButton:pressed, QPushButton:pressed, QToolButton:checked {
      background: #e6f4f1;
      border-color: #0f766e;
      color: #0f766e;
    }

    QToolButton:disabled, QPushButton:disabled {
      background: #f2f4f7;
      border-color: #e4e7ec;
      color: #98a2b3;
    }

    QLineEdit, QTextEdit, QPlainTextEdit, QTreeWidget, QListWidget, QScrollArea {
      background: #ffffff;
      border: 1px solid #d8dee7;
      border-radius: 7px;
      selection-background-color: #0f766e;
      selection-color: #ffffff;
    }

    QLineEdit {
      min-height: 30px;
    }

    QLineEdit, QTextEdit, QPlainTextEdit {
      padding: 6px 9px;
    }

    QTextEdit, QPlainTextEdit {
      font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
      font-size: 12px;
    }

    QTreeWidget, QListWidget {
      outline: 0;
      alternate-background-color: #fbfcfe;
    }

    QTreeWidget::item, QListWidget::item {
      padding: 5px 8px;
      border-radius: 6px;
    }

    QTreeWidget::item:hover, QListWidget::item:hover {
      background: #eef6f5;
    }

    QTreeWidget::item:selected, QListWidget::item:selected {
      background: #d9efeb;
      color: #0b4f49;
    }

    QSplitter::handle {
      background: #d8dee7;
    }

    QSplitter::handle:horizontal {
      width: 1px;
    }

    QSplitter::handle:vertical {
      height: 1px;
    }

    QLabel#appTitle {
      font-size: 18px;
      font-weight: 650;
      color: #101828;
    }

    QLabel#appSubtitle, QLabel#sectionLabel {
      color: #667085;
    }

    QLabel#panelHeading {
      font-size: 14px;
      font-weight: 650;
      color: #101828;
    }

    QLabel#assetPreview {
      background: #f7f9fc;
      color: #667085;
      border-radius: 7px;
    }

    QWidget#editorHeader {
      background: #ffffff;
      border: 1px solid #d8dee7;
      border-radius: 8px;
      padding: 10px;
    }

    QWidget#editorHeader QLabel {
      background: transparent;
      border: none;
    }

    QFrame#sectionRule {
      background: #d8dee7;
      max-height: 1px;
    }

    QWebEngineView {
      background: #ffffff;
      border: 1px solid #d8dee7;
      border-radius: 7px;
    }

    QScrollBar:vertical, QScrollBar:horizontal {
      background: transparent;
      border: 0;
      margin: 0;
    }

    QScrollBar:vertical {
      width: 10px;
    }

    QScrollBar:horizontal {
      height: 10px;
    }

    QScrollBar::handle {
      background: #c8d1df;
      border-radius: 5px;
      min-height: 28px;
      min-width: 28px;
    }

    QScrollBar::handle:hover {
      background: #98a2b3;
    }

    QScrollBar::add-line, QScrollBar::sub-line {
      width: 0;
      height: 0;
    }
  )");
}
