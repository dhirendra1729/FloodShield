{
  description = "development environment for drag";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forEachSystem (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              
              python311
              python311Packages.pip
              python311Packages.virtualenv

              gdal
              geos
              proj
              postgresql
              
              # Added dependencies for building native python extensions
              pkg-config
              zlib
              libffi
              openssl
            ];

            shellHook = ''
              export LD_LIBRARY_PATH=${pkgs.stdenv.cc.cc.lib}/lib:${pkgs.zlib}/lib:${pkgs.gdal}/lib:${pkgs.geos}/lib:${pkgs.proj}/lib:$LD_LIBRARY_PATH

              if [ ! -d "backend/.venv" ]; then
                python3 -m venv backend/.venv
              fi
              export PATH=$PWD/backend/.venv/bin:$PATH

              if [ -f "backend/requirements.txt" ]; then
                pip install -r backend/requirements.txt > /dev/null 2>&1
              fi

              if [ -d "frontend" ] && [ ! -d "frontend/node_modules" ]; then
                cd frontend
                npm install > /dev/null 2>&1
                cd ..
              fi
            '';
          };
        }
      );
    };
}
