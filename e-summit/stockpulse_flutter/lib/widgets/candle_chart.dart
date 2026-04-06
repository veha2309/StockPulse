import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../providers/market_provider.dart';
import '../theme/app_theme.dart';

class CandleChart extends StatefulWidget {
  final List<CandleData> data;
  final double height;

  const CandleChart({super.key, required this.data, this.height = 350});

  @override
  State<CandleChart> createState() => _CandleChartState();
}

class _CandleChartState extends State<CandleChart> {
  int? _hoverIndex;
  Offset? _touchPosition;

  @override
  Widget build(BuildContext context) {
    if (widget.data.isEmpty) {
      return const Center(child: Text("No data available", style: TextStyle(color: AppTheme.onSurfaceVariant)));
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final double chartWidth = constraints.maxWidth - 52; // Account for price labels
        final int visibleCount = widget.data.length;
        final double candleWidth = (chartWidth / visibleCount) * 0.6;
        final double spacing = (chartWidth / visibleCount) * 0.4;
        final double step = chartWidth / visibleCount;

        return SizedBox(
          height: widget.height,
          child: Padding(
            padding: const EdgeInsets.only(right: 52, top: 10, bottom: 20),
            child: GestureDetector(
              onPanStart: (details) => _updateHover(details.localPosition, step, visibleCount),
              onPanUpdate: (details) => _updateHover(details.localPosition, step, visibleCount),
              onPanEnd: (_) => setState(() { _hoverIndex = null; _touchPosition = null; }),
              onTapDown: (details) => _updateHover(details.localPosition, step, visibleCount),
              onTapUp: (_) => setState(() { _hoverIndex = null; _touchPosition = null; }),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  CustomPaint(
                    size: Size(chartWidth, widget.height),
                    painter: CandlePainter(
                      data: widget.data, 
                      hoverIndex: _hoverIndex,
                      touchPosition: _touchPosition,
                      candleWidth: candleWidth,
                      spacing: spacing,
                      step: step,
                    ),
                  ),
                  if (_hoverIndex != null && _hoverIndex! >= 0 && _hoverIndex! < widget.data.length)
                    _buildTooltip(widget.data[_hoverIndex!], _hoverIndex!, step, chartWidth),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _updateHover(Offset localPos, double step, int count) {
    int idx = (localPos.dx / step).floor();
    if (idx < 0) idx = 0;
    if (idx >= count) idx = count - 1;

    final candle = widget.data[idx];
    
    // Find nearest vertical price point (O, H, L, C)
    final prices = [candle.open, candle.high, candle.low, candle.close];
    double maxHigh = widget.data.map((e) => e.high).reduce(max);
    double minLow = widget.data.map((e) => e.low).reduce(min);
    final range = maxHigh - minLow;
    final chartMax = maxHigh + range * 0.15;
    final chartMin = minLow - range * 0.15;
    final finalRange = chartMax - chartMin;

    double nearestPrice = prices[0];
    double minDelta = 1e9;
    
    for (var p in prices) {
      double py = widget.height - 30 - ((p - chartMin) / finalRange * (widget.height - 30)); // Adjusted for padding
      double delta = (localPos.dy - py).abs();
      if (delta < minDelta) {
        minDelta = delta;
        nearestPrice = p;
      }
    }

    if (_hoverIndex != idx) {
      HapticFeedback.selectionClick();
    }

    setState(() {
      _hoverIndex = idx;
      // Snap Y to the nearest price point's vertical coordinate
      double snappedY = widget.height - 30 - ((nearestPrice - chartMin) / finalRange * (widget.height - 30));
      _touchPosition = Offset(localPos.dx, snappedY);
    });
  }

  Widget _buildTooltip(CandleData candle, int index, double step, double chartWidth) {
    // Determine tooltip side to prevent overflow
    double left = (index * step) + 10;
    if (left + 100 > chartWidth) {
      left = (index * step) - 110;
    }

    return Positioned(
      top: 0,
      left: max(0, left),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("${candle.date.day}/${candle.date.month} ${candle.date.hour.toString().padLeft(2,'0')}:${candle.date.minute.toString().padLeft(2,'0')}", 
              style: const TextStyle(color: AppTheme.primary, fontSize: 9, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            _tooltipRow("O", candle.open),
            _tooltipRow("H", candle.high),
            _tooltipRow("L", candle.low),
            _tooltipRow("C", candle.close),
          ],
        ),
      ),
    );
  }

  Widget _tooltipRow(String label, double val) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text("$label: ", style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 9)),
        Text("₹${val.toStringAsFixed(2)}", style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
      ],
    );
  }
}

class CandlePainter extends CustomPainter {
  final List<CandleData> data;
  final int? hoverIndex;
  final Offset? touchPosition;
  final double candleWidth;
  final double spacing;
  final double step;

  CandlePainter({
    required this.data,
    this.hoverIndex,
    this.touchPosition,
    required this.candleWidth,
    required this.spacing,
    required this.step,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    double maxHigh = data.map((e) => e.high).reduce(max);
    double minLow = data.map((e) => e.low).reduce(min);
    
    final range = maxHigh - minLow;
    maxHigh += range * 0.15;
    minLow -= range * 0.15;
    final finalRange = maxHigh - minLow;

    final gridPaint = Paint()..color = Colors.white.withValues(alpha: 0.05)..strokeWidth = 0.5;

    // Price Grid
    for (int i = 0; i <= 6; i++) {
      double y = size.height * i / 6;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
      double price = maxHigh - (finalRange * i / 6);
      _drawText(canvas, Offset(size.width + 8, y - 7), "₹${price.toStringAsFixed(0)}", fontSize: 9);
    }

    // Dynamic Vertical Grid (Time marks)
    int timeInterval = (data.length / 5).ceil();
    for (int i = 0; i < data.length; i += timeInterval) {
      double x = i * step + (step / 2);
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
      _drawText(canvas, Offset(x - 15, size.height + 5), "${data[i].date.day}/${data[i].date.month}", fontSize: 8);
    }

    // PRO CROSSHAIR
    if (hoverIndex != null && touchPosition != null) {
      double cx = hoverIndex! * step + (step / 2);
      double cy = touchPosition!.dy.clamp(0, size.height);
      final crossPaint = Paint()..color = AppTheme.primary.withValues(alpha: 0.4)..strokeWidth = 1.0;
      
      // Vertical
      canvas.drawLine(Offset(cx, 0), Offset(cx, size.height), crossPaint);
      // Horizontal
      canvas.drawLine(Offset(0, cy), Offset(size.width, cy), crossPaint);

      // Price Indicator (Right Axis)
      double priceAtTouch = maxHigh - (cy / size.height * finalRange);
      _drawPriceBadge(canvas, Offset(size.width + 1, cy - 8), "₹${priceAtTouch.toStringAsFixed(2)}");
    }

    // Draw Candles
    for (int i = 0; i < data.length; i++) {
      final candle = data[i];
      final isBullish = candle.close >= candle.open;
      final Color candleColor = isBullish ? AppTheme.primary : AppTheme.secondary;
      final p = Paint()..color = candleColor..style = PaintingStyle.fill;
      final wickPaint = Paint()..color = candleColor.withValues(alpha: 0.6)..strokeWidth = 1.0;

      double x = i * step + (spacing / 2);
      
      double highY = _priceToY(candle.high, size.height, maxHigh, minLow, finalRange);
      double lowY = _priceToY(candle.low, size.height, maxHigh, minLow, finalRange);
      double openY = _priceToY(candle.open, size.height, maxHigh, minLow, finalRange);
      double closeY = _priceToY(candle.close, size.height, maxHigh, minLow, finalRange);

      canvas.drawLine(Offset(x + candleWidth / 2, highY), Offset(x + candleWidth / 2, lowY), wickPaint);

      double bodyTop = min(openY, closeY);
      double bodyBottom = max(openY, closeY);
      if ((bodyBottom - bodyTop).abs() < 1.0) bodyBottom = bodyTop + 1.0; 
      
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTRB(x, bodyTop, x + candleWidth, bodyBottom), const Radius.circular(1)),
        p,
      );
    }
  }

  double _priceToY(double price, double height, double maxHigh, double minLow, double range) {
    if (range == 0) return height / 2;
    return height - ((price - minLow) / range * height);
  }

  void _drawText(Canvas canvas, Offset offset, String text, {double fontSize = 10}) {
    final textPainter = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: fontSize)),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, offset);
  }

  void _drawPriceBadge(Canvas canvas, Offset offset, String text) {
     final textPainter = TextPainter(
      text: TextSpan(text: text, style: const TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.bold)),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();

    final bgRect = Rect.fromLTWH(offset.dx, offset.dy, textPainter.width + 10, textPainter.height + 4);
    canvas.drawRRect(RRect.fromRectAndRadius(bgRect, const Radius.circular(4)), Paint()..color = AppTheme.primary);
    textPainter.paint(canvas, Offset(offset.dx + 5, offset.dy + 2));
  }

  @override
  bool shouldRepaint(covariant CandlePainter oldDelegate) => true;
}
