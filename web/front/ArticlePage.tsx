import { useRouter } from 'next/router'
import React from 'react'

import CustomLink from 'front/CustomLink'
import LoadingSpinner from 'front/LoadingSpinner'
import Maybe from 'front/Maybe'
import UserLinkWithImage from 'front/UserLinkWithImage'
import FollowUserButton from 'front/FollowUserButton'
import { displayAndUsernameText } from 'front/user'
import Article from 'front/Article'
import ArticleInfo from 'front/ArticleInfo'
import { AppContext, useEEdit } from 'front'
import { webApi } from 'front/api'
import fetcher from 'front/fetcher'
import routes from 'front/routes'
import { ArticleType } from 'front/types/ArticleType'
import { CommentType } from 'front/types/CommentType'
import { UserType } from 'front/types/UserType'

export interface ArticlePageProps {
  article: ArticleType;
  comments?: CommentType[];
  loggedInUser?: UserType;
  sameArticleByLoggedInUser?: string;
  topicArticleCount: number;
}

const ArticlePage = ({
  article,
  comments,
  loggedInUser,
  sameArticleByLoggedInUser,
  topicArticleCount,
}: ArticlePageProps) => {
  const router = useRouter();

  const { setTitle } = React.useContext(AppContext)
  React.useEffect(() =>
    setTitle(`${article.title} by ${displayAndUsernameText(article?.file?.author)}`)
  )
  const showOthers = topicArticleCount > 1
  const showCreateMyOwn = !loggedInUser || article.file.author.username !== loggedInUser.username
  const canEdit = loggedInUser && loggedInUser?.username === article?.file?.author?.username
  useEEdit(canEdit, article.slug)
  return (
    <>
      <div className="article-page">
        <div className="content-not-ourbigbook article-meta">
          <div className="article-info">
            <span className="mobile-hide">Author: </span>
            <UserLinkWithImage user={article.file.author} showUsernameMobile={false} />
            {' '}
            <FollowUserButton {...{ user: article.file.author, loggedInUser, showUsername: false }} />
          </div>
          <div className="article-info article-info-2">
            { showOthers&&
              <CustomLink
                href={routes.topicArticlesTop(article.topicId)}
              >
                <i className="ion-ios-people" /> {topicArticleCount - 1}<span className="mobile-hide"> article{topicArticleCount - 1 > 1 ? 's' : ''}</span> by other authors<span className="mobile-hide"> about "{article.title}"</span>
              </CustomLink>
            }
            {showOthers && showCreateMyOwn && <>{' '}</> }
            {showCreateMyOwn &&
              <>
                {sameArticleByLoggedInUser === undefined
                  ? <CustomLink
                      href={routes.articleNewFrom(article.slug)}
                    >
                      <i className="ion-edit" /> Create my own version
                    </CustomLink>
                  : <CustomLink
                      href={routes.articleView(sameArticleByLoggedInUser)}
                    >
                      <i className="ion-eye" /> View mine
                    </CustomLink>
                }
              </>
            }
          </div>
          <ArticleInfo {...{ article, loggedInUser }}/>
        </div>
        <div className="container page">
          <Article {...{ article, comments, loggedInUser }} />
        </div>
      </div>
    </>
  );
};

export default ArticlePage;
