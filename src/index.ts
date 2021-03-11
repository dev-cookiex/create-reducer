import pick from '@cookiex/dot-object/dist/pick'
import set from '@cookiex/dot-object/dist/set'

export interface AnyAction {
  type: any
  data?: any
  target?: string
}

const combineReducers = <T, A>(
  map: { [K in keyof T]: ( state: T[K], action: A ) => T[K] },
  nullish: boolean = false
): ( state: T, action: A ) => T => {
  const reducers = Object.entries<( state: any, action: any ) => any>( map )
  return ( state, action ) => {
    if ( nullish && !state ) return state

    let newerState = state

    for ( const [ key, reducer ] of reducers ) {
      const newer = reducer( state[key], action )
      if ( state[key] !== newer )
        newerState = { ...newerState, [key]: newer }
    }

    return newerState
  }
}

type CompositeConfiguration<T, A, Act extends AnyAction> = T extends object
  ? {
    [K in keyof T]?: Configuration<T[K], A, Act, K extends keyof A ? K : null>
  }
  : undefined | null

type KeyOfConfiguration<T, A, Act extends AnyAction, C extends keyof A | null = null> =
  keyof (
    C extends keyof A
      ? { [K in keyof A[C]]?: ( state: T, data: A[C][K] ) => T }
      : { [K in keyof A]?: ( state: T, data: A[K] ) => T }
  )
type Configuration<T, A, Act extends AnyAction, C extends keyof A | null = null> =
  & (
    C extends keyof A
      ? { [K in keyof A[C]]?: ( state: T, data: A[C][K] ) => T }
      : { [K in keyof A]?: ( state: T, data: A[K] ) => T }
  )
  & ( {
      [DEFAULT]?: ( state: T, action: Act ) => T
      [COMPOSE]?: CompositeConfiguration<T, A, Act>
    } | {
      [DEFAULT]?: ( state: T, action: Act ) => T
      [COMPOSE_NULLISH]?: CompositeConfiguration<T, A, Act>
    } )

interface createReducer {
  <T, A, Act extends AnyAction = AnyAction>(
    config: Configuration<T, A, Act>
  ): ( state: T, action: Act ) => T
}

const extractKeys = <T>( data: T ): ( keyof T )[] => [
  ...Object.getOwnPropertyNames( data ),
  ...Object.getOwnPropertySymbols( data ),
] as ( keyof T )[]

const createReducer: createReducer = <T, A, Act extends AnyAction = AnyAction>(
  config: Configuration<T, A, Act>
) => {
  const keys = extractKeys( config ).filter( privateFilter ) as ( KeyOfConfiguration<T, A, Act> )[]

  const composeIsNullish = COMPOSE_NULLISH in config

  const hasCompose = composeIsNullish || COMPOSE in config

  const composeKey = COMPOSE in config ? COMPOSE : COMPOSE_NULLISH

  const sub = hasCompose && [
    ...Object.getOwnPropertyNames( config[composeKey] ),
    ...Object.getOwnPropertySymbols( config[composeKey] )
  ].reduce(
    ( reducers, key ) => ( {
      ...reducers,
      [key]: createReducer( config[composeKey][key] )
    } ),
    {} as any
  )

  const combine = COMPOSE in config && combineReducers<any, any>( sub, composeIsNullish )

  const reducer = ( state: T, action: Act ) => {
    const key = keys.find( key => key === action.type )

    if ( action.target ) {
      const target = pick( action.target, reducer )
      if ( target ) return set( action.target as string, state, target( pick( action.target, state ), action ) )
    }

    if ( key in config ) return config[key]( state, action.data )

    if ( COMPOSE in config ) return combine( state, action )

    if ( DEFAULT in config ) return config[DEFAULT]( state, action )

    return ( state ?? {} ) as T
  }

  Object.assign( reducer, sub )

  return reducer
}

export const COMPOSE = Symbol( 'store-reducer-compose' )

export const COMPOSE_NULLISH = Symbol( 'store-reducer-compose-nullish' )

export const DEFAULT = Symbol( 'store-reducer-default' )

const privateKeys = [ COMPOSE, DEFAULT ]

const privateFilter = <K extends keyof any>( key: K ): key is Exclude<K, typeof COMPOSE | typeof DEFAULT | typeof COMPOSE_NULLISH>  =>
  !privateKeys.includes( key as symbol )

export default createReducer
