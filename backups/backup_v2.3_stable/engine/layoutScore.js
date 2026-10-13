function scoreLayout(layout) {
  var score = 0;
  score += layout.tagsPerPieceNominal * 1000;
  score += (layout.utilization || 0) * 10;
  score -= (layout.leftoverL || 0) * 5;
  score -= (layout.leftoverW || 0) * 5;
  return score;
}
