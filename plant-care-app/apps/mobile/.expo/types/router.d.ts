/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(app)` | `/(app)/(tabs)` | `/(app)/(tabs)/plants` | `/(app)/(tabs)/settings` | `/(app)/plants` | `/(app)/plants/new` | `/(app)/settings` | `/(auth)` | `/(auth)/login` | `/(auth)/register` | `/(tabs)` | `/(tabs)/plants` | `/(tabs)/settings` | `/..\..\web\.next\types\app\(app)\layout` | `/..\..\web\.next\types\app\(app)\plants\page` | `/..\..\web\.next\types\app\(auth)\layout` | `/..\..\web\.next\types\app\(auth)\login\page` | `/..\..\web\.next\types\app\layout` | `/..\..\web\.next\types\app\page` | `/_sitemap` | `/login` | `/plants` | `/plants/new` | `/register` | `/settings`;
      DynamicRoutes: `/(app)/plants/${Router.SingleRoutePart<T>}` | `/(app)/plants/${Router.SingleRoutePart<T>}/edit` | `/plants/${Router.SingleRoutePart<T>}` | `/plants/${Router.SingleRoutePart<T>}/edit`;
      DynamicRouteTemplate: `/(app)/plants/[id]` | `/(app)/plants/[id]/edit` | `/plants/[id]` | `/plants/[id]/edit`;
    }
  }
}
