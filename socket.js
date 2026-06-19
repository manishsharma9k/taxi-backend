let _io = null;

export const setIo = (io) => {
  _io = io;
};

export const getIo = () => {
  if (!_io) throw new Error('Socket.IO not initialized');
  return _io;
};

export default { setIo, getIo };
