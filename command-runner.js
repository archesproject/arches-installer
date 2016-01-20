(function () {
    var ko = require('knockout');
    var sudoExec = require('electron-sudo').exec;
    var sudo = {
        exec: function(cmd, callback) {
            var options = {
                name: 'Arches Installer',
                icns: './assets/img/arches_logo.icns'
            };
            sudoExec(cmd, options, callback);
        }
    };
    var cp = require('child_process');

    // commands should look like this:
    // [{
    //   description: 'Saying hello',
    //   getCommand: function () { return 'echo hello' },
    //   sudo: true
    // }]
    var CommandRunner = function(commands) {
        var self = this;
        this.current = ko.observable(0);
        this.running = ko.observable(false);
        this.commands = commands;
        this.success = ko.computed(function () {
            return (self.current() === self.commands.length);
        });
        this.process = null;
    };

    CommandRunner.prototype = {
        constructor: CommandRunner,

        start: function () {
            this.running(true);
            this.current(0);
            this.next();
        },

        end: function (noKill) {
            if (this.process && !noKill) {
                this.process.kill();
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
                console.log(current, command.description + '...')
                var p = command.sudo ? sudo : cp;
                this.process = p.exec(command.getCommand(), function(error, stdout, stderr) {
                    command.error = error;
                    command.stdout = stdout;
                    command.stderr = stderr;
                    if (error) {
                        self.end(true);
                    } else {
                        self.current(current+1);
                        self.next();
                    }
                });
            }
        }
    };

    module.exports = CommandRunner;
})();
