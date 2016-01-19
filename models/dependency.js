var Backbone = require('backbone');
var ko = require('knockout');

module.exports = Backbone.Model.extend({
  initialize: function (options) {
    var exec = require('child_process').exec;
    var self = this;
    this.ready = ko.observable(false);
    this.parseVersion = options.parseVersion ? options.parseVersion : function (stdout, stderr) {
      return (stdout+stderr!=='');
    };
    this.versionCmd = options.versionCmd ? options.versionCmd : '';

    this.check = function () {
    	var child = exec(self.versionCmd, function (error, stdout, stderr) {
    	  self.ready(self.parseVersion(stdout, stderr));
    	});
    };

    this.check();
  }
});
