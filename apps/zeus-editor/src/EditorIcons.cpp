#include "EditorIcons.h"

#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QPen>

namespace {

constexpr int kCanvas = 24;

QPen iconPen(const QColor& color, qreal width = 1.8) {
  QPen pen(color, width, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin);
  pen.setCosmetic(true);
  return pen;
}

void drawArrow(QPainter& painter, bool forward) {
  painter.drawLine(QPointF(forward ? 7 : 17, 12), QPointF(forward ? 17 : 7, 12));
  painter.drawLine(QPointF(forward ? 13 : 11, 7), QPointF(forward ? 18 : 6, 12));
  painter.drawLine(QPointF(forward ? 13 : 11, 17), QPointF(forward ? 18 : 6, 12));
}

}  // namespace

QIcon editorIcon(EditorIcon icon, const QColor& color, const QSize& size) {
  QPixmap pixmap(size);
  pixmap.fill(Qt::transparent);

  QPainter painter(&pixmap);
  painter.setRenderHint(QPainter::Antialiasing, true);
  painter.scale(size.width() / qreal(kCanvas), size.height() / qreal(kCanvas));
  painter.setPen(iconPen(color));
  painter.setBrush(Qt::NoBrush);

  switch (icon) {
    case EditorIcon::ArrowBack:
      drawArrow(painter, false);
      break;
    case EditorIcon::ArrowForward:
      drawArrow(painter, true);
      break;
    case EditorIcon::ArrowUp:
      painter.drawLine(QPointF(12, 18), QPointF(12, 6));
      painter.drawLine(QPointF(7, 11), QPointF(12, 6));
      painter.drawLine(QPointF(17, 11), QPointF(12, 6));
      break;
    case EditorIcon::Refresh:
      painter.drawArc(QRectF(5, 5, 14, 14), 45 * 16, 270 * 16);
      painter.drawLine(QPointF(17, 5), QPointF(19, 9));
      painter.drawLine(QPointF(17, 5), QPointF(13, 5));
      break;
    case EditorIcon::Terminal:
      painter.drawRoundedRect(QRectF(4.5, 5.5, 15, 13), 2, 2);
      painter.drawLine(QPointF(8, 10), QPointF(11, 12));
      painter.drawLine(QPointF(8, 14), QPointF(11, 12));
      painter.drawLine(QPointF(13, 15), QPointF(17, 15));
      break;
    case EditorIcon::Viewport:
      painter.drawRoundedRect(QRectF(4.5, 5.5, 15, 13), 2, 2);
      painter.drawLine(QPointF(4.5, 9), QPointF(19.5, 9));
      painter.drawLine(QPointF(8, 18.5), QPointF(16, 18.5));
      break;
    case EditorIcon::Update:
      painter.drawLine(QPointF(12, 5), QPointF(12, 15));
      painter.drawLine(QPointF(8, 11), QPointF(12, 15));
      painter.drawLine(QPointF(16, 11), QPointF(12, 15));
      painter.drawLine(QPointF(7, 19), QPointF(17, 19));
      break;
    case EditorIcon::Kill:
      painter.drawLine(QPointF(7, 7), QPointF(17, 17));
      painter.drawLine(QPointF(17, 7), QPointF(7, 17));
      painter.drawRoundedRect(QRectF(4.5, 4.5, 15, 15), 7.5, 7.5);
      break;
    case EditorIcon::Play: {
      QPainterPath path;
      path.moveTo(8, 6);
      path.lineTo(18, 12);
      path.lineTo(8, 18);
      path.closeSubpath();
      painter.setBrush(color);
      painter.drawPath(path);
      break;
    }
    case EditorIcon::Stop:
      painter.setBrush(color);
      painter.drawRoundedRect(QRectF(7, 7, 10, 10), 1.5, 1.5);
      break;
    case EditorIcon::Folder:
      painter.drawPath([] {
        QPainterPath path;
        path.moveTo(4.5, 8);
        path.lineTo(10, 8);
        path.lineTo(12, 10);
        path.lineTo(19.5, 10);
        path.lineTo(19.5, 18.5);
        path.lineTo(4.5, 18.5);
        path.closeSubpath();
        return path;
      }());
      break;
    case EditorIcon::File:
      painter.drawPath([] {
        QPainterPath path;
        path.moveTo(7, 4.5);
        path.lineTo(14, 4.5);
        path.lineTo(18, 8.5);
        path.lineTo(18, 19.5);
        path.lineTo(7, 19.5);
        path.closeSubpath();
        return path;
      }());
      painter.drawLine(QPointF(14, 4.5), QPointF(14, 8.5));
      painter.drawLine(QPointF(14, 8.5), QPointF(18, 8.5));
      break;
    case EditorIcon::Image:
      painter.drawRoundedRect(QRectF(5, 6, 14, 12), 2, 2);
      painter.drawEllipse(QPointF(15, 10), 1.2, 1.2);
      painter.drawLine(QPointF(7, 16), QPointF(11, 12));
      painter.drawLine(QPointF(11, 12), QPointF(14, 15));
      painter.drawLine(QPointF(14, 15), QPointF(16, 13));
      painter.drawLine(QPointF(16, 13), QPointF(19, 16));
      break;
    case EditorIcon::Search:
      painter.drawEllipse(QPointF(10.5, 10.5), 5, 5);
      painter.drawLine(QPointF(14.5, 14.5), QPointF(19, 19));
      break;
  }

  return QIcon(pixmap);
}
