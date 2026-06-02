{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.nodejs_20
    pkgs.bash
    pkgs.stdenv.cc.cc.lib
    pkgs.zlib
    pkgs.glib
    pkgs.postgresql
  ];
  env = {
    LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
      pkgs.stdenv.cc.cc.lib
      pkgs.zlib
      pkgs.glib
    ];
  };
}
