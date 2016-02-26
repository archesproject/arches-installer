(function () {
    var ko = require('knockout');
    var shell = require('shell');
    var mustache = require('mustache');
    var gist = require('octonode').client().gist();

    var CommandRunner = function(name, commands, postExec) {
        var self = this;
        this.name = name;
        this.postExec = postExec;
        this.current = ko.observable(0);
        this.running = ko.observable(false);
        this.error = ko.observable(false);
        this.commands = commands;
        this.currentCommand = ko.computed(function () {
            return self.commands[self.current()];
        });
        this.error = ko.computed(function () {
            var error = false;
            if (!self.running()) {
                for (var i = 0; i < self.commands.length; i++) {
                    if (self.commands[i].error()) {
                        error = self.commands[i].error();
                    }
                }
            }
            return error;
        });
        this.complete = ko.computed(function () {
            if (self.error()) {
                return true;
            }
            return (self.current() === self.commands.length);
        });
        this.success = ko.computed(function () {
            var success = true;
            if (self.running()) {
                return false;
            }
            for (var i = 0; i < self.commands.length; i++) {
                if (!self.commands[i].success()) {
                    success = false;
                }
            }
            return success;
        });
        this.process = null;
    };

    CommandRunner.prototype = {
        constructor: CommandRunner,

        start: function () {
            for (var i = 0; i < this.commands.length; i++) {
                this.commands[i].complete(false);
            }
            this.current(0);
            this.running(true);
            this.next();
        },

        end: function (noKill) {
            if (this.process && !noKill) {
                this.process.kill();
            }
            if (this.postExec) {
                this.postExec();
            }
            this.process = null;
            this.running(false);
        },

        next: function () {
            var self = this;
            var current = this.current();
            var command = this.commands[current];
            if (current === this.commands.length) {
                this.end(true);
                return;
            } else {
                command.run(function() {
                    if (command.error()) {
                        self.end(true);
                    } else {
                        self.current(current+1);
                        self.next();
                    }
                });
            }
        },

        createGHIssue: function () {
            var errorInfo = {
                name: this.name,
                step: this.current(),
                description: this.currentCommand().description,
                version: require('../package.json').version,
                platform: process.platform,
                arch: process.arch
            };

            var description = mustache.render("Arches Installer v{{version}}, failed installing {{name}} on step {{step}} ({{description}}) platform: {{platform}} {{arch}}", errorInfo);
            gist.create({
                "description": description,
                "public": true,
                "files": {
                    "output.txt": {
                        "content": this.currentCommand().stderr() + '\n' + this.currentCommand().stdout()
                    }
                }
            }, function(err, data) {
                if (!err) {
                    var issueUrl = encodeURI('https://github.com/archesproject/arches-installer/issues/new?title=' + description + '&body=see output here: ' + data.html_url);
                    shell.openExternal(issueUrl);
                }
            });
        }
    };

    module.exports = CommandRunner;
})();
