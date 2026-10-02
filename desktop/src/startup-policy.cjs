function shouldShowIntro(previous, version) {
  return previous?.version !== version || previous?.pendingUpdate === true;
}
module.exports = { shouldShowIntro };
