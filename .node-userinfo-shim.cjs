// Work around Node 24 + sandbox uv_os_get_passwd ENOMEM in tsx.
if (typeof process.geteuid !== 'function') {
  process.geteuid = () => 0;
}
