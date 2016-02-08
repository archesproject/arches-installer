# Arches Installer

A desktop application for OSX, Windows, and Linux to help install [Arches](https://github.com/archesproject/arches) and it's dependencies.

Built using [Electron](http://electron.atom.io/).

## Install dependencies

```sh
npm install 
```

## Run

```sh
npm start
```

## Package

```sh
# package for osx
npm run package-osx

# package for windows
npm run package-windows

# package for linux
npm run package-linux

# package all
npm run package-all
```

Packaging for Windows outside of a Windows environment requires installing [Wine](https://www.winehq.org/) (see [here](https://github.com/maxogden/electron-packager#building-windows-apps-from-non-windows-platforms)).
