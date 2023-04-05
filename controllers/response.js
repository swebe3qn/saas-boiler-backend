exports.returnError = (res, message = '', status = undefined) => {
  return res.status(status || 400).json({
    success: false,
    message: message || 'Fehler'
  })
}