(function () {
    var ko = require('knockout');

    var CommandRunner = function(commands, postExec) {
        var self = this;
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
        }
    };

    module.exports = CommandRunner;
})();
