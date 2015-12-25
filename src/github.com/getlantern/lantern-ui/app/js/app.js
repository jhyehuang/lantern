'use strict';

var app = angular.module('app', [
  'ngWebSocket',
  'ngSanitize',
  'ngResource',
  'LocalStorageModule',
  'stripe.checkout',
  'pascalprecht.translate',
  'ui.validate',
  'ui.bootstrap',
  'ui.bootstrap.tpls',
  'app.constants',
  'app.helpers',
  'app.filters',
  'app.services',
  'app.directives'
])
.directive('dynamic', ['$compile', function ($compile) {
  return {
    restrict: 'A',
    replace: true,
    link: function (scope, ele, attrs) {
      scope.$watch(attrs.dynamic, function(html) {
        ele.html(html);
        $compile(ele.contents())(scope);
      });
    }
  };
}])
.config([
  '$tooltipProvider',
  '$httpProvider',
  '$resourceProvider',
  '$translateProvider',
  'StripeCheckoutProvider',
  'STRIPE_PUB_KEY',
  'DEFAULT_LANG',
  function($tooltipProvider, $httpProvider, $resourceProvider, $translateProvider, StripeCheckoutProvider, STRIPE_PUB_KEY, DEFAULT_LANG) {

    $translateProvider.preferredLanguage(DEFAULT_LANG);
    $translateProvider.useStaticFilesLoader({
      prefix: './locale/',
      suffix: '.json'
    });
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common["X-Requested-With"];
    //$httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    $tooltipProvider.options({
      appendToBody: true
    });
    StripeCheckoutProvider.defaults({
      key: STRIPE_PUB_KEY
    });
  }
])
// angular-ui config
.value('ui.config', {
  animate: 'ui-hide',
})
// split array displays separates an array inside a textarea with newlines
.directive('splitArray', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {

      function fromUser(text) {
        return text.split("\n");
      }

      function toUser(array) {
        if (array) {
          return array.join("\n");
        }
      }

      ngModel.$parsers.push(fromUser);
      ngModel.$formatters.push(toUser);
    }
  };
})
.run(['$filter',
     '$log',
     '$rootScope',
     '$timeout',
     '$window',
     '$websocket',
     '$translate',
     '$http',
     'apiSrvc',
     'gaMgr',
     'modelSrvc',
     'ENUMS',
     'EXTERNAL_URL',
     'MODAL',
     'CONTACT_FORM_MAXLEN',
     function ($filter, $log, $rootScope, $timeout, $window, $websocket, $translate, $http, apiSrvc, gaMgr, modelSrvc, ENUMS, EXTERNAL_URL, MODAL, CONTACT_FORM_MAXLEN) {
       var CONNECTIVITY = ENUMS.CONNECTIVITY,
       MODE = ENUMS.MODE,
       jsonFltr = $filter('json'),
       model = modelSrvc.model,
       prettyUserFltr = $filter('prettyUser'),
       reportedStateFltr = $filter('reportedState');

       // for easier inspection in the JavaScript console
       $window.rootScope = $rootScope;
       $window.model = model;

       $rootScope.EXTERNAL_URL = EXTERNAL_URL;

       $rootScope.model = model;
       $rootScope.DEFAULT_AVATAR_URL = 'img/default-avatar.png';
       $rootScope.CONTACT_FORM_MAXLEN = CONTACT_FORM_MAXLEN;

       angular.forEach(ENUMS, function(val, key) {
         $rootScope[key] = val;
       });

       $rootScope.reload = function () {
         location.reload(true); // true to bypass cache and force request to server
       };

       $rootScope.switchLang = function (lang) {
         $rootScope.lang = lang;
         $translate.use(lang);
       };

       $rootScope.trackPageView = function() {
         gaMgr.trackPageView();
       };

       $rootScope.valByLang = function(name) {
         // use language-specific forums URL
         if (name && $rootScope.lang && 
             name.hasOwnProperty($rootScope.lang)) {
           return name[$rootScope.lang];
         }
         // default to English language forum
         return name['en_US'];
       };

       $rootScope.changeLang = function(lang) {
         return $rootScope.interaction(INTERACTION.changeLang, {lang: lang});
       };

       $rootScope.openRouterConfig = function() {
         return $rootScope.interaction(INTERACTION.routerConfig);
       };

       $rootScope.openExternal = function(url) {
         return $window.open(url);
       };

       $rootScope.resetContactForm = function (scope) {
         if (scope.show) {
           var reportedState = jsonFltr(reportedStateFltr(model));
           scope.diagnosticInfo = reportedState;
         }
       };

       $rootScope.interactionWithNotify = function (interactionid, scope, reloadAfter) {
         var extra;
         if (scope.notify) {
           var diagnosticInfo = scope.diagnosticInfo;
           if (diagnosticInfo) {
             try {
               diagnosticInfo = angular.fromJson(diagnosticInfo);
             } catch (e) {
               $log.debug('JSON decode diagnosticInfo', diagnosticInfo, 'failed, passing as-is');
             }
           }
           extra = {
             context: model.modal,
             message: scope.message,
             diagnosticInfo: diagnosticInfo
           };
         }
         $rootScope.interaction(interactionid, extra).then(function () {
           if (reloadAfter) $rootScope.reload();
         });
       };

       $rootScope.backendIsGone = false;
       $rootScope.$watch("wsConnected", function(wsConnected) {
         var MILLIS_UNTIL_BACKEND_CONSIDERED_GONE = 10000;
         if (!wsConnected) {
           // Temporary workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1192773
           if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
             $rootScope.backendIsGone = true;
           } else {
             // In 11 seconds, check if we're still not connected
             $timeout(function() {
               var lastConnectedAt = $rootScope.wsLastConnectedAt;
               if (lastConnectedAt) {
                 var timeSinceLastConnected = new Date().getTime() - lastConnectedAt.getTime();
                 $log.debug("Time since last connect", timeSinceLastConnected);
                 if (timeSinceLastConnected > MILLIS_UNTIL_BACKEND_CONSIDERED_GONE) {
                   // If it's been more than 10 seconds since we last connect,
                   // treat the backend as gone
                   console.log("Backend is gone");
                   $rootScope.backendIsGone = true;
                 } else {
                   $rootScope.backendIsGone = false;
                 }
               }
             }, MILLIS_UNTIL_BACKEND_CONSIDERED_GONE + 1000);
           }
         }
       });
     }
]);
