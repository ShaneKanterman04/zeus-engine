#pragma once

#include <QColor>
#include <QIcon>
#include <QSize>

enum class EditorIcon {
  ArrowBack,
  ArrowForward,
  ArrowUp,
  Refresh,
  Terminal,
  Viewport,
  Update,
  Kill,
  Play,
  Stop,
  Folder,
  File,
  Image,
  Search,
};

QIcon editorIcon(EditorIcon icon, const QColor& color = QColor("#344054"), const QSize& size = QSize(18, 18));
