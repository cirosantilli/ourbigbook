import { useRouter } from 'next/router'
import React from 'react'

import CustomLink from 'front/CustomLink'
import LoadingSpinner from 'front/LoadingSpinner'
import Maybe from 'front/Maybe'
import UserLinkWithImage from 'front/UserLinkWithImage'
import FollowUserButton from 'front/FollowUserButton'
import { DisplayAndUsername, displayAndUsernameText } from 'front/user'
import Article from 'front/Article'
import ArticleInfo from 'front/ArticleInfo'
import { AppContext, DiscussionAbout, useEEdit } from 'front'
import { webApi } from 'front/api'
import { cant } from 'front/cant'
import fetcher from 'front/fetcher'
import routes from 'front/routes'
import { ArticleType } from 'front/types/ArticleType'
import { CommentType } from 'front/types/CommentType'
import { IssueType } from 'front/types/IssueType'
import { UserType } from 'front/types/UserType'

export interface ArticlePageProps {
  article: ArticleType & IssueType;
  comments?: CommentType[];
  commentsCount?: number;
  issueArticle?: ArticleType;
  issuesCount?: number;
  latestIssues?: IssueType[];
  loggedInUser?: UserType;
  sameArticleByLoggedInUser?: string;
  topIssues?: IssueType[];
  topicArticleCount?: number;
}

const ArticlePageHoc = (isIssue=false) => {
  return ({
    article,
    comments,
    commentsCount,
    issueArticle,
    latestIssues,
    topIssues,
    issuesCount,
    loggedInUser,
    sameArticleByLoggedInUser,
    topicArticleCount,
  }: ArticlePageProps) => {
    const router = useRouter();

    const author = article.author
    const { setTitle } = React.useContext(AppContext)
    React.useEffect(() =>
      // TODO here we would like to have a plaintext render of the title.
      // https://github.com/cirosantilli/ourbigbook/issues/250
      setTitle(`${isIssue ? article.titleSource : article.file.titleSource} by ${displayAndUsernameText(author)}`)
    )
    const showOthers = topicArticleCount !== undefined && topicArticleCount > 1
    const showCreateMyOwn = !loggedInUser || author.username !== loggedInUser.username
    const canEdit = loggedInUser && (isIssue ? !cant.editIssue(loggedInUser, article) : loggedInUser.username === article.author.username)
    useEEdit(canEdit, article.slug)
    return (
      <>
        <div className="article-page">
          <div className="content-not-ourbigbook article-meta">
            {isIssue && <DiscussionAbout article={issueArticle} issue={article} />}
            <div className="article-info">
              <span className="mobile-hide">Author: </span>
              <UserLinkWithImage user={author} showUsernameMobile={false} />
              {' '}
              <FollowUserButton {...{ user: author, loggedInUser, showUsername: false }} />
            </div>
            {!isIssue &&
              <div className="article-info article-info-2">
                  {showOthers &&
                    <CustomLink
                      href={routes.topic(article.topicId, { sort: 'score' })}
                    >
                      <i className="ion-ios-people" /> {topicArticleCount - 1}<span className="mobile-hide"> article{
                        topicArticleCount - 1 > 1 ? 's' : ''}</span> by others<span className="mobile-hide"> about "<span
                        className="ourbigbook-title" dangerouslySetInnerHTML={{ __html: article.titleRender }} />"</span>
                    </CustomLink>
                  }
                  {showOthers && showCreateMyOwn && <>{' '}</> }
                  {(showCreateMyOwn) &&
                    <>
                      {sameArticleByLoggedInUser === undefined
                        ? <CustomLink
                            href={routes.articleNewFrom(article.slug)}
                          >
                            <i className="ion-edit" /> Create my own version
                          </CustomLink>
                        : <CustomLink
                            href={routes.article(sameArticleByLoggedInUser)}
                          >
                            <i className="ion-eye" /> View mine
                          </CustomLink>
                      }
                    </>
                  }
              </div>
            }
            <ArticleInfo {...{ article, isIssue, issueArticle, loggedInUser }}/>
          </div>
          <div className="container page">
            <Article {...{
              article,
              comments,
              commentsCount,
              issueArticle,
              isIssue,
              issuesCount,
              latestIssues,
              loggedInUser,
              topIssues,
            }} />
          </div>
        </div>
      </>
    );
  };
}

export default ArticlePageHoc;
