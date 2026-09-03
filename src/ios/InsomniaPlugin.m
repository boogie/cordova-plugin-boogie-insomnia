#import "InsomniaPlugin.h"
#import <UIKit/UIKit.h>

static NSString *const kInsomniaPluginId = @"cordova-plugin-boogie-insomnia";
static NSString *const kInsomniaPluginVersion = @"1.1.0"; // keep in sync with plugin.xml

@interface InsomniaPlugin ()
@property (nonatomic, assign) BOOL keepAwakeActive;
@end

@implementation InsomniaPlugin

- (void)pluginInitialize {
  // External UI (camera, photo picker) can re-enable the idle timer behind our
  // back — re-assert the keep-awake whenever the app becomes active again.
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(onAppDidBecomeActive)
                                               name:UIApplicationDidBecomeActiveNotification
                                             object:nil];
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)onAppDidBecomeActive {
  if (self.keepAwakeActive) {
    [self setIdleTimerDisabled:YES];
  }
}

// A page navigation destroys the JS state that requested the keep-awake; don't
// leave the screen forced on with nothing tracking it.
- (void)onReset {
  if (self.keepAwakeActive) {
    self.keepAwakeActive = NO;
    [self setIdleTimerDisabled:NO];
  }
}

- (void)keepAwake:(CDVInvokedUrlCommand *)command {
  self.keepAwakeActive = YES;
  [self setIdleTimerDisabled:YES];
  [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
                              callbackId:command.callbackId];
}

- (void)allowSleepAgain:(CDVInvokedUrlCommand *)command {
  self.keepAwakeActive = NO;
  [self setIdleTimerDisabled:NO];
  [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
                              callbackId:command.callbackId];
}

- (void)isKeptAwake:(CDVInvokedUrlCommand *)command {
  CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                                messageAsBool:self.keepAwakeActive];
  [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

// Bridge contract v1: what this native half is and can do, from static facts
// only — no permissions, no I/O, never fails. `actions` lists every selector
// Cordova can dispatch here, sorted.
- (void)describe:(CDVInvokedUrlCommand *)command {
  NSDictionary *envelope = @{
    @"id": kInsomniaPluginId,
    @"version": kInsomniaPluginVersion,
    @"platform": @"ios",
    @"api": @1,
    @"actions": @[@"allowSleepAgain", @"describe", @"isKeptAwake", @"keepAwake"],
    @"features": @{
      @"reassertOnResume": @YES // UIApplicationDidBecomeActiveNotification re-disables the idle timer
    }
  };
  CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                          messageAsDictionary:envelope];
  [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

// UIApplication must be touched on the main thread; plugin methods already run
// there, but the notification path makes no such guarantee.
- (void)setIdleTimerDisabled:(BOOL)disabled {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].idleTimerDisabled = disabled;
  });
}

@end
