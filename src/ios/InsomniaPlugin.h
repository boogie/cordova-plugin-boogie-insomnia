#import <Cordova/CDV.h>

@interface InsomniaPlugin : CDVPlugin

- (void)keepAwake:(CDVInvokedUrlCommand *)command;
- (void)allowSleepAgain:(CDVInvokedUrlCommand *)command;
- (void)isKeptAwake:(CDVInvokedUrlCommand *)command;
- (void)describe:(CDVInvokedUrlCommand *)command;

@end
