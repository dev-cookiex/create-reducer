import pick from '@cookiex/dot-object/dist/pick'

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

type Configuration<T, A> =
  & { [K in keyof A]?: ( state: T, data: A[K] ) => T }
  & {
    [DEFAULT]?: ( state: T ) => T
    [COMPOSE]?: T extends object ? {
      [K in keyof T]?: Configuration<T[K], A>
    } : undefined
  }

interface createReducer {
  <T, A, Act extends AnyAction = AnyAction>(
    config: Configuration<T, A>
  ): ( state: T, action: Act ) => T
}

const createReducer: createReducer = <T, A, Act extends AnyAction = AnyAction>(
  config: Configuration<T, A>
) => {
  const keys = [
    ...Object.getOwnPropertyNames( config ),
    ...Object.getOwnPropertySymbols( config )
  ].filter( privateFilter ) as ( keyof A )[]

  const composeIsNullish = COMPOSE_NULLISH in config

  const hasCompose = composeIsNullish || COMPOSE in config

  const sub = hasCompose && [
    ...Object.getOwnPropertyNames( config[COMPOSE] ),
    ...Object.getOwnPropertySymbols( config[COMPOSE] )
  ].reduce(
    ( reducers, key ) => ( { ...reducers, [key]: createReducer( config[COMPOSE][key] ) } ),
    {} as any
  )

  const combine = COMPOSE in config && combineReducers<any, any>( sub, composeIsNullish )

  const reducer = ( state: T, action: Act ) => {
    const key = keys.find( key => key === action.type )

    if ( action.target ) {
      const target = pick( action.target, reducer )
      if ( target ) return target( pick( action.target, state ), action )
    }

    if ( key in config ) return config[key]( state, action.data )

    if ( COMPOSE in config ) return combine( state, action )

    if ( DEFAULT in config ) return config[DEFAULT]( state )

    return ( state ?? {} ) as T
  }

  Object.assign( reducer, sub )

  return reducer
}

export const COMPOSE = Symbol( 'store-reducer-compose' )

export const COMPOSE_NULLISH = Symbol( 'store-reducer-compose-nullish' )

export const DEFAULT = Symbol( 'store-reducer-default' )

const privateKeys = [ COMPOSE, DEFAULT ]

const privateFilter = ( key: string | symbol ) => !privateKeys.includes( key as symbol )

export default createReducer
